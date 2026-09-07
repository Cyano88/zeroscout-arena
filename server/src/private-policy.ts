import { createHash } from 'node:crypto'
import { ethers } from 'ethers'

export const PRIVATE_OWNER = '0xa2ae0a3b3ed7b30ab049685a934de587a0f51d66'
export const PRIVATE_PATHS = ['/api/integrations/intelligence', '/api/integrations/intelligence/readiness', '/api/integrations/polydesk-general-research', '/api/integrations/agreement-intelligence']
export const DEFAULT_PRIVATE_LIMITS = { daily: 100, minute: 5, concurrent: 2, days: 30 }
export function privateLimits(raw: Record<string, unknown> = {}) {
  const values = { ...DEFAULT_PRIVATE_LIMITS, ...raw }
  for (const [key, max] of Object.entries({ daily: 100, minute: 5, concurrent: 2, days: 30 })) {
    const value = values[key as keyof typeof values]
    if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > max) throw new Error('Invalid private-key limit')
  }
  return { daily: values.daily, minute: values.minute, concurrent: values.concurrent, days: values.days }
}
export function ownerActionMessage(method: string, path: string, body: unknown, nonce: string, expires: number) {
  return ['ZeroScout private key administration', 'Owner: ' + PRIVATE_OWNER, 'Method: ' + method,
    'Path: ' + path, 'Body SHA256: ' + createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex'),
    'Nonce: ' + nonce, 'Expires: ' + expires].join('\n')
}
export function verifyPrivateOwner(method: string, path: string, body: unknown, nonce: string, expires: number, signature: string, now = Date.now()) {
  if (!/^[a-f0-9]{64}$/i.test(nonce) || !Number.isSafeInteger(expires) || expires <= now || expires > now + 300_000) throw new Error('Invalid or expired owner authorization')
  if (ethers.verifyMessage(ownerActionMessage(method, path, body, nonce, expires), signature).toLowerCase() !== PRIVATE_OWNER) throw new Error('Owner signature required')
}
