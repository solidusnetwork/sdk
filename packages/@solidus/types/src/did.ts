export interface DID {
  id: string          // "did:solidus:stub:abc123"
  controller: string
  created: string     // ISO 8601
  updated: string
  network: 'stub' | 'testnet' | 'mainnet'
}

export interface VerificationMethod {
  id: string
  type: 'Ed25519VerificationKey2020'
  controller: string
  publicKeyMultibase: string  // base58btc-encoded public key, 'z' prefix
}

export interface DIDDocument {
  '@context': string[]
  id: string
  controller: string
  verificationMethod: VerificationMethod[]
  authentication: string[]
  assertionMethod: string[]
  created: string
  updated: string
}
