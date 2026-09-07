export const privateServices = [
  { id: 'lp-intelligence', label: 'LP Intelligence', description: 'Intelligence, readiness checks, and PolyDesk general research.', paths: ['/api/integrations/intelligence', '/api/integrations/intelligence/readiness', '/api/integrations/polydesk-general-research'] },
  { id: 'agreement-intelligence', label: 'Agreement Intelligence', description: 'Agreement evidence reviews only. Does not grant LP or general research access.', paths: ['/api/integrations/agreement-intelligence'] },
  { id: 'all-private', label: 'All Private Services', description: 'Both intelligence and agreement services. Excludes video, passports, and helper sponsorship.', paths: ['/api/integrations/intelligence', '/api/integrations/intelligence/readiness', '/api/integrations/polydesk-general-research', '/api/integrations/agreement-intelligence'] },
] as const
export type PrivateService = typeof privateServices[number]['id']
export function privateService(value: unknown): PrivateService {
  if (!privateServices.some(service => service.id === value)) throw new Error('Invalid private service selection')
  return value as PrivateService
}
export function privateServiceAllows(value: unknown, path: string): boolean {
  return privateServices.some(service => service.id === value && (service.paths as readonly string[]).includes(path))
}
