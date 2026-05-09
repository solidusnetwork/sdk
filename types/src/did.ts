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
  /** W3C DID Core §5.3.2 — verification methods authorised to issue assertions. */
  assertionMethod: string[]
  /** W3C DID Core §5.3.3 — verification methods for ECDH key agreement.
   *  Optional for backward compat with documents serialized before
   *  2026-05-09; chain-stored documents now always carry this field. */
  keyAgreement?: string[]
  /** W3C DID Core §5.3.4 — verification methods authorised to invoke capabilities. */
  capabilityInvocation?: string[]
  /** W3C DID Core §5.3.5 — verification methods authorised to delegate capabilities. */
  capabilityDelegation?: string[]
  created: string
  updated: string
}
