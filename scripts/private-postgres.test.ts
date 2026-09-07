import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createHash, randomBytes } from 'node:crypto'
import pg from 'pg'
import { createPrivateAccess, initializePrivateDatabase } from '../server/src/private-access.js'
import { PRIVATE_OWNER } from '../server/src/private-policy.js'

const url = process.env.ZS_PRIVATE_TEST_DATABASE_URL
if (!url) throw new Error('Explicit isolated ZS_PRIVATE_TEST_DATABASE_URL required')
const parsed = new URL(url)
if (!['127.0.0.1','localhost'].includes(parsed.hostname) || parsed.port !== '55439' || parsed.pathname !== '/zs_private_test') throw new Error('Refusing non-isolated database')
const db = new pg.Pool({ connectionString:url, ssl:false, max:20, connectionTimeoutMillis:5000, statement_timeout:10000 })
process.env.ZEROSCOUT_PRIVATE_MODE='true'
const access=createPrivateAccess({database:async()=>db})
// Only persistence tests substitute wallet verification; signature rejection is
// independently covered in private-access.test.ts. Production uses the real verifier.
const management=createPrivateAccess({database:async()=>db,verifyOwner:()=>{}})
async function call(token:string, handler=access, path='/api/integrations/intelligence', body:unknown={}, nonce=randomBytes(32).toString('hex')) {
  const response=new EventEmitter() as EventEmitter & { statusCode:number; body:any; status:(n:number)=>any; json:(b:unknown)=>any }
  response.statusCode=0
  response.status=n=>{response.statusCode=n;return response}
  response.json=b=>{response.body=b;return response}
  let admitted=false
  await handler({method:'POST',path,body,get:(n:string)=>({authorization:'Bearer '+token,'x-zs-nonce':nonce,'x-zs-expires':String(Date.now()+60000),'x-zs-signature':'test-double'} as Record<string,string>)[n]} as any,response as any,()=>{admitted=true})
  return {admitted,status:response.statusCode,response}
}
async function seed(id:string, overrides: {daily?:number;minute?:number;concurrent?:number;revoked?:boolean;expired?:boolean;owner?:string}={}) {
  const token='zs_private_'+randomBytes(32).toString('base64url')
  await db.query('INSERT INTO zs_private_keys(id,key_hash,name,owner_wallet,expires_at,revoked,daily_limit,minute_limit,concurrent_limit) VALUES($1,$2,$1,$3,$4,$5,$6,$7,$8)',[id,createHash('sha256').update(token).digest('hex'),overrides.owner??PRIVATE_OWNER,new Date(Date.now()+(overrides.expired?-60000:3600000)),overrides.revoked??false,overrides.daily??100,overrides.minute??5,overrides.concurrent??2])
  return token
}
async function reset() { await db.query('TRUNCATE zs_private_keys,zs_private_nonces,zs_private_usage,zs_private_leases') }

test('isolated PostgreSQL private-access concurrency suite',async t=>{
  try {
    await initializePrivateDatabase(db)
    await t.test('parallel requests admit only two and rejected reservations roll back',async()=>{
      await reset(); const token=await seed('parallel')
      const results=await Promise.all(Array.from({length:20},()=>call(token)))
      assert.equal(results.filter(r=>r.admitted).length,2)
      assert.equal(results.filter(r=>r.status===429).length,18)
      assert.equal((await db.query('SELECT count(*)::int n FROM zs_private_leases')).rows[0].n,2)
      assert((await db.query('SELECT used FROM zs_private_usage')).rows.every(r=>r.used===2))
    })
    await t.test('minute cap rolls back global and daily increments',async()=>{
      await reset(); const token=await seed('minute',{minute:1})
      assert((await call(token)).admitted); await db.query('DELETE FROM zs_private_leases')
      assert.equal((await call(token)).status,429)
      assert((await db.query('SELECT used FROM zs_private_usage')).rows.every(r=>r.used===1))
    })
    await t.test('daily and global ceilings reject without committing partial counters',async()=>{
      await reset(); const token=await seed('day',{daily:1})
      assert((await call(token)).admitted); await db.query('DELETE FROM zs_private_leases')
      assert.equal((await call(token)).status,429)
      await db.query("UPDATE zs_private_usage SET used=500 WHERE bucket LIKE 'global:%'")
      const other=await seed('other'); assert.equal((await call(other)).status,429)
      assert.equal((await db.query("SELECT count(*)::int n FROM zs_private_usage WHERE bucket LIKE 'other:%'")).rows[0].n,0)
    })
    await t.test('revoked, expired and non-owner keys never reserve quota',async()=>{
      await reset()
      for(const [id,options] of [['revoked',{revoked:true}],['expired',{expired:true}],['other',{owner:'0x'+'11'.repeat(20)}]] as const) assert.equal((await call(await seed(id,options))).status,401)
      assert.equal((await db.query('SELECT count(*)::int n FROM zs_private_usage')).rows[0].n,0)
    })
    await t.test('nonce replay across simultaneous management calls creates only one key',async()=>{
      await reset(); const nonce='ab'.repeat(32)
      const results=await Promise.all(Array.from({length:8},()=>call('',management,'/api/private/keys',{name:'test'},nonce)))
      assert.equal(results.filter(r=>r.status===401).length,7)
      assert.equal((await db.query('SELECT count(*)::int n FROM zs_private_keys')).rows[0].n,1)
    })
    await t.test('revocation endpoint denies subsequent calls and finish releases leases',async()=>{
      await reset(); const id='aa'.repeat(12), token=await seed(id)
      const accepted=await call(token); assert(accepted.admitted)
      accepted.response.emit('finish')
      for(let i=0;i<20;i++){if(!(await db.query('SELECT count(*)::int n FROM zs_private_leases')).rows[0].n)break;await new Promise(r=>setTimeout(r,10))}
      assert.equal((await db.query('SELECT count(*)::int n FROM zs_private_leases')).rows[0].n,0)
      const revoked=await call('',management,`/api/private/keys/${id}/revoke`)
      assert.equal(revoked.response.body.revoked,true)
      assert.equal((await call(token)).status,401)
    })
    await t.test('database errors fail closed',async()=>{
      const failing=createPrivateAccess({database:async()=>{throw new Error('database unavailable')}})
      assert.equal((await call('zs_private_'+'a'.repeat(43),failing)).status,503)
    })
  } finally { await db.end() }
})
