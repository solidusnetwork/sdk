export type KYCLevel = 0 | 1 | 2 | 3

export type VerificationStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired'

export interface CredentialProof {
  type: 'Ed25519Signature2020'
  created: string
  verificationMethod: string
  proofPurpose: 'assertionMethod'
  proofValue: string  // base64url-encoded Ed25519 signature
}

export interface VerifiableCredential {
  '@context': string[]
  id: string
  type: string[]
  issuer: string              // DID of issuer
  issuanceDate: string
  expirationDate?: string
  credentialSubject: {
    id: string               // DID of subject
    [key: string]: unknown
  }
  proof: CredentialProof
}

export interface IssueCredentialParams {
  subjectDid: string
  issuerDid: string
  issuerPrivateKey: string    // hex-encoded 32-byte Ed25519 private key
  type: string[]
  claims: Record<string, unknown>
  expiresInDays?: number
  network?: 'stub' | 'testnet' | 'mainnet'
}

export interface VerificationResult {
  valid: boolean
  credentialId?: string
  error?: string
  checks: {
    signature: boolean
    expiry: boolean
    revocation: boolean
  }
}
