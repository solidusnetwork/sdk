/**
 * Ambient types for `@digitalbazaar/bbs-signatures` 3.0.0 (it ships with
 * no `.d.ts` of its own). Only the surface we use is declared.
 */
declare module '@digitalbazaar/bbs-signatures' {
  export const CIPHERSUITES: {
    BLS12381_SHAKE256: 'BLS12-381-SHAKE-256'
    BLS12381_SHA256: 'BLS12-381-SHA-256'
  }

  type Ciphersuite =
    | typeof CIPHERSUITES.BLS12381_SHAKE256
    | typeof CIPHERSUITES.BLS12381_SHA256

  export function generateKeyPair(opts: {
    ciphersuite: Ciphersuite
    seed?: Uint8Array
  }): Promise<{ secretKey: Uint8Array; publicKey: Uint8Array }>

  export function secretKeyToPublicKey(opts: {
    secretKey: Uint8Array
    ciphersuite: Ciphersuite
  }): Promise<Uint8Array>

  export function sign(opts: {
    secretKey: Uint8Array
    publicKey: Uint8Array
    header?: Uint8Array
    messages: Uint8Array[]
    ciphersuite: Ciphersuite
  }): Promise<Uint8Array>

  export function verifySignature(opts: {
    publicKey: Uint8Array
    signature: Uint8Array
    header?: Uint8Array
    messages: Uint8Array[]
    ciphersuite: Ciphersuite
  }): Promise<boolean>

  export function deriveProof(opts: {
    publicKey: Uint8Array
    signature: Uint8Array
    header?: Uint8Array
    presentationHeader?: Uint8Array
    messages: Uint8Array[]
    disclosedMessageIndexes: number[]
    ciphersuite: Ciphersuite
  }): Promise<Uint8Array>

  export function verifyProof(opts: {
    publicKey: Uint8Array
    proof: Uint8Array
    header?: Uint8Array
    presentationHeader?: Uint8Array
    disclosedMessages: Uint8Array[]
    disclosedMessageIndexes: number[]
    ciphersuite: Ciphersuite
  }): Promise<boolean>
}
