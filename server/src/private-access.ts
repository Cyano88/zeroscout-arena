import type { Request, Response, NextFunction } from 'express'
import { randomBytes, createHash } from 'node:crypto'
import pg from 'pg'
import { config } from './config.js'
import { PRIVATE_OWNER, PRIVATE_PATHS, privateLimits, verifyPrivateOwner } from './private-policy.js'
import { privateService, privateServiceAllows } from '../../shared/private-services.js'

const identities = new WeakMap<Request, { id: string; name: string; partner: string }>()
export const privateIdentity = (req: Request) => identities.get(req)
export const privateMode = () => process.env.ZEROSCOUT_PRIVATE_MODE === 'true'
let pool: pg.Pool | undefined
let initialization: Promise<unknown> | undefined
async function database() {
  if (!config.databaseUrl) throw new Error('Private mode requires PostgreSQL')
  pool ??= new pg.Pool({ connectionString: config.databaseUrl, ssl: config.databaseUrl.includes('railway.internal') ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 5000, statement_timeout: 10000 })
  initialization ??= initializePrivateDatabase(pool).catch(error => { initialization = undefined; throw error })
  await initialization
  return pool
}
export async function initializePrivateDatabase(db: pg.Pool) {
  return db.query(`
    CREATE TABLE IF NOT EXISTS zs_private_keys (id text PRIMARY KEY, key_hash text UNIQUE NOT NULL, name text NOT NULL, owner_wallet text NOT NULL, expires_at timestamptz NOT NULL, revoked boolean NOT NULL DEFAULT false, daily_limit integer NOT NULL, minute_limit integer NOT NULL, concurrent_limit integer NOT NULL);
    ALTER TABLE zs_private_keys ADD COLUMN IF NOT EXISTS service text NOT NULL DEFAULT 'all-private';
    ALTER TABLE zs_private_keys ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'PolyDesk';
    CREATE TABLE IF NOT EXISTS zs_private_nonces (nonce text PRIMARY KEY, expires_at timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS zs_private_usage (bucket text PRIMARY KEY, used integer NOT NULL);
    CREATE TABLE IF NOT EXISTS zs_private_leases (id text PRIMARY KEY, key_id text NOT NULL, expires_at timestamptz NOT NULL);
  `)
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex')

export function createPrivateAccess(dependencies: { database?: () => Promise<pg.Pool>; verifyOwner?: typeof verifyPrivateOwner } = {}) {
const getDatabase = dependencies.database ?? database
const verifyOwner = dependencies.verifyOwner ?? verifyPrivateOwner
return async function privateAccess(req: Request, res: Response, next: NextFunction) {
  const managementPath = req.path === '/api/private/keys' || /^\/api\/private\/keys\/[a-f0-9]{24}\/revoke$/.test(req.path)
  const staged = process.env.ZEROSCOUT_PRIVATE_KEYS_STAGING === 'true'
  const privateToken = req.get('authorization')?.startsWith('Bearer zs_private_')
  if (!privateMode() && !(staged && (managementPath || privateToken))) return next()
  // Serve the signing interface and static assets; API access remains default-deny.
  if (req.method === 'GET' && !req.path.startsWith('/api/')) return next()
  // Health is liveness-only. No public AI-health, dashboard, admin, or upload path.
  if (req.method === 'GET' && req.path === '/api/health') return next()
  try {
    const management = req.path === '/api/private/keys' || /^\/api\/private\/keys\/[a-f0-9]{24}\/revoke$/.test(req.path)
    if (management) {
      if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' })
      const nonce = req.get('x-zs-nonce') || ''
      const expires = Number(req.get('x-zs-expires'))
      verifyOwner(req.method, req.path, req.body, nonce, expires, req.get('x-zs-signature') || '')
      const db = await getDatabase()
      const client = await db.connect()
      try {
        await client.query('BEGIN')
        await client.query("SELECT pg_advisory_xact_lock(704921)")
        await client.query('DELETE FROM zs_private_nonces WHERE expires_at < now()')
        await client.query('INSERT INTO zs_private_nonces(nonce,expires_at) VALUES($1,$2)', [nonce, new Date(expires)])
        let output: unknown
        if (req.path.endsWith('/revoke')) {
          if (req.method !== 'POST') throw new Error('Method not allowed')
          const result = await client.query('UPDATE zs_private_keys SET revoked=true WHERE id=$1 AND owner_wallet=$2 RETURNING id', [req.path.split('/')[4], PRIVATE_OWNER])
          output = { revoked: result.rowCount === 1 }
        } else if (req.method === 'GET') {
          output = { keys: (await client.query('SELECT id,name,platform,service,expires_at,revoked,daily_limit,minute_limit,concurrent_limit FROM zs_private_keys WHERE owner_wallet=$1', [PRIVATE_OWNER])).rows }
        } else {
          const limits = privateLimits(req.body?.limits)
          const service = privateService(req.body?.service)
          const platform = String(req.body?.platform || 'PolyDesk').trim().slice(0,80) || 'PolyDesk'
          const active = await client.query('SELECT count(*)::int AS count FROM zs_private_keys WHERE revoked=false AND expires_at>now()')
          if (active.rows[0].count >= 10) throw new Error('Private key count limit reached')
          const id = randomBytes(12).toString('hex')
          const key = 'zs_private_' + randomBytes(32).toString('base64url')
          const expiresAt = new Date(Date.now() + limits.days * 86400000)
          await client.query('INSERT INTO zs_private_keys(id,key_hash,name,owner_wallet,expires_at,daily_limit,minute_limit,concurrent_limit) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id, hash(key), String(req.body?.name || 'polydesk').slice(0,80), PRIVATE_OWNER, expiresAt, limits.daily, limits.minute, limits.concurrent])
          await client.query('UPDATE zs_private_keys SET service=$1,platform=$2 WHERE id=$3', [service,platform,id])
          output = { id, key, expiresAt, limits, service, platform }
        }
        await client.query('COMMIT')
        return res.json(output)
      } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
    }
    if (req.method !== 'POST' || !PRIVATE_PATHS.includes(req.path)) return res.status(403).json({ error: 'Private service: route unavailable' })
    const token = req.get('authorization')?.replace(/^Bearer /, '') || ''
    if (!/^zs_private_[A-Za-z0-9_-]{43}$/.test(token)) return res.status(401).json({ error: 'Private API key required' })
    const db = await getDatabase()
    const client = await db.connect()
    const readiness = req.path === '/api/integrations/intelligence/readiness'
    const lease = randomBytes(16).toString('hex')
    let identity: { id: string; name: string; partner: string }
    try {
      await client.query('BEGIN')
      await client.query('SELECT pg_advisory_xact_lock(704921)')
      const key = (await client.query('SELECT * FROM zs_private_keys WHERE key_hash=$1 AND owner_wallet=$2 AND revoked=false AND expires_at>now()', [hash(token), PRIVATE_OWNER])).rows[0]
      if (!key) { await client.query('ROLLBACK'); return res.status(401).json({ error: 'Invalid or expired private key' }) }
      if (!privateServiceAllows(key.service, req.path)) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Private key does not permit this service' }) }
      await client.query('DELETE FROM zs_private_leases WHERE expires_at<=now()')
      const active = (await client.query('SELECT count(*)::int AS count FROM zs_private_leases WHERE key_id=$1', [key.id])).rows[0].count
      const globalActive = (await client.query('SELECT count(*)::int AS count FROM zs_private_leases')).rows[0].count
      if (active >= key.concurrent_limit || globalActive >= 4) throw new Error('Private usage limit reached')
      const time = (await client.query("SELECT to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD') AS day, to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD-HH24-MI') AS minute")).rows[0]
      for (const [bucket, cap] of [[`global:${time.day}`,500],[`${key.id}:day:${time.day}`,key.daily_limit],[`${key.id}:minute:${time.minute}`,key.minute_limit]] as [string,number][]) {
        const current = (await client.query('SELECT used FROM zs_private_usage WHERE bucket=$1', [bucket])).rows[0]?.used || 0
        const required = readiness && (req.body?.analysisType === 'polydesk-smart-market-research' || req.body?.proofClass === 'polydesk_smart_market_research') ? 2 : 1
        if (current + required > cap) throw new Error('Private usage limit reached')
        if (readiness) continue
        await client.query('INSERT INTO zs_private_usage(bucket,used) VALUES($1,1) ON CONFLICT(bucket) DO UPDATE SET used=zs_private_usage.used+1', [bucket])
      }
      if (readiness) {
        const bucket = `${key.id}:readiness:${time.minute}`
        const used = (await client.query('SELECT used FROM zs_private_usage WHERE bucket=$1', [bucket])).rows[0]?.used || 0
        if (used >= 30) throw new Error('Private usage limit reached')
        await client.query('INSERT INTO zs_private_usage(bucket,used) VALUES($1,1) ON CONFLICT(bucket) DO UPDATE SET used=zs_private_usage.used+1', [bucket])
      }
      if (!readiness) await client.query("INSERT INTO zs_private_leases(id,key_id,expires_at) VALUES($1,$2,now()+interval '10 minutes')", [lease,key.id])
      identity = { id: key.id, name: key.name, partner: key.platform }
      await client.query('COMMIT')
    } catch(error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
    identities.set(req, identity)
    if (!readiness) res.once('finish', () => { void db.query('DELETE FROM zs_private_leases WHERE id=$1', [lease]).catch(() => undefined) })
    return next()
  } catch(error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'Invalid private service selection') return res.status(400).json({ error: message })
    if (message.includes('limit')) return res.status(429).json({ error: 'Private usage limit reached' })
    if (message.includes('authorization') || message.includes('signature') || message.includes('duplicate key')) return res.status(401).json({ error: 'Invalid or replayed owner authorization' })
    return res.status(503).json({ error: 'Private access unavailable; request refused' })
  }
}
}
export const privateAccess = createPrivateAccess()
