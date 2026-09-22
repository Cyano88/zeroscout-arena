export const privateServices = [
  { id: 'crypto-fundraising', label: 'Crypto Fundraising Intelligence', description: 'Source-linked historical funding rounds, public token sales and launchpad raises. Partial research coverage; dedicated key only.', paths: ['/api/integrations/crypto-fundraising'] },
  { id: 'smart-contract-auditing', label: 'Smart Contract Auditing', description: 'Solidity security reviews for Grail: access paths, state changes and false-positive checks.', paths: ['/api/integrations/smart-contract-audit'] },
  { id: 'lp-intelligence', label: 'LP Intelligence', description: 'Intelligence, readiness checks, and PolyDesk general research.', paths: ['/api/integrations/intelligence', '/api/integrations/intelligence/readiness', '/api/integrations/polydesk-general-research'] },
  { id: 'agreement-intelligence', label: 'Agreement Intelligence', description: 'Agreement evidence reviews only. Does not grant LP or general research access.', paths: ['/api/integrations/agreement-intelligence'] },
  { id: 'all-private', label: 'LP + Agreement', description: 'LP and agreement services. Smart Contract Auditing and Crypto Fundraising require separate keys. Excludes video, passports, and helper sponsorship.', paths: ['/api/integrations/intelligence', '/api/integrations/intelligence/readiness', '/api/integrations/polydesk-general-research', '/api/integrations/agreement-intelligence'] },
] as const
export type PrivateService = typeof privateServices[number]['id']
export function privateService(value: unknown): PrivateService {
  if (!privateServices.some(service => service.id === value)) throw new Error('Invalid private service selection')
  return value as PrivateService
}
export function privateServiceAllows(value: unknown, path: string): boolean {
  return privateServices.some(service => service.id === value && (service.paths as readonly string[]).includes(path))
}
