export type { KYCLevel, VerificationStatus } from './vc.js'

export type SandboxOutcome = 'pass' | 'fail' | 'timeout' | 'document_rejected'

export interface VerificationSession {
  id: string
  organizationId: string
  subjectDid?: string
  level: import('./vc.js').KYCLevel
  status: import('./vc.js').VerificationStatus
  credentialId?: string
  sandbox: boolean
  sandboxOutcome?: SandboxOutcome
  createdAt: string
  updatedAt: string
}
