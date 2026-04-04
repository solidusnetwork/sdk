import * as ed from '@noble/ed25519'
import type { Challenge } from './challenge.js'

export interface VerifiablePresentation {
  '@context': string[]
  /** Must include 'VerifiablePresentation' */
  type: string[]
  /** DID of the presenter */
  holder: string
  verifiableCredential?: unknown[] | undefined
  proof: {
    type: string                  // e.g. 'Ed25519Signature2020'
    created: string               // ISO 8601
    /** Must match challenge.nonce */
    challenge: string
    proofPurpose: string          // 'authentication'
    /** DID#key-id — passed to getPublicKey */
    verificationMethod: string
    /** Detached JWS: base64url(header)..base64url(signature) */
    jws: string
  }
}

export interface PresentationVerificationResult {
  valid: boolean
  error?: string
  checks: {
    notExpired: boolean
    holderMatches: boolean
    nonceMatches: boolean
    signatureValid: boolean
  }
}

/**
 * Verify a W3C Verifiable Presentation against a challenge.
 *
 * Checks (in order, fail-fast):
 * 1. Challenge not expired
 * 2. Holder DID matches challenge DID
 * 3. Proof nonce matches challenge nonce
 * 4. EdDSA signature valid
 *
 * @param challenge - Previously issued challenge
 * @param presentation - Verifiable Presentation from the holder
 * @param getPublicKey - Async resolver: given a verificationMethod ID, return the Ed25519 public key (32 bytes)
 */
export async function verifyPresentation(
  challenge: Challenge,
  presentation: VerifiablePresentation,
  getPublicKey: (verificationMethodId: string) => Promise<Uint8Array>,
): Promise<PresentationVerificationResult> {
  const checks = {
    notExpired: false,
    holderMatches: false,
    nonceMatches: false,
    signatureValid: false,
  }

  // 1. Not expired
  checks.notExpired = new Date() < new Date(challenge.expiresAt)
  if (!checks.notExpired) {
    return { valid: false, error: 'Challenge expired', checks }
  }

  // 2. Holder matches
  checks.holderMatches = presentation.holder === challenge.did
  if (!checks.holderMatches) {
    return { valid: false, error: 'Holder DID does not match challenge DID', checks }
  }

  // 3. Nonce matches
  checks.nonceMatches = presentation.proof.challenge === challenge.nonce
  if (!checks.nonceMatches) {
    return { valid: false, error: 'Nonce mismatch', checks }
  }

  // 4. Signature valid
  // Detached JWS format: "base64url(header)..base64url(signature)"
  // The signed payload is: base64url(header) + "." + base64url(canonicalPresentation)
  // where canonicalPresentation = JSON.stringify(presentation without proof field)
  try {
    const jwsParts = presentation.proof.jws.split('.')
    if (jwsParts.length !== 3) {
      return { valid: false, error: 'Invalid JWS format: expected 3 dot-separated parts', checks }
    }
    const [jwsHeader, , jwsSig] = jwsParts as [string, string, string]

    // Canonical payload: presentation without proof, deterministic JSON
    const { proof: _proof, ...presentationWithoutProof } = presentation
    const canonicalPayload = Buffer.from(
      JSON.stringify(presentationWithoutProof),
    ).toString('base64url')

    const signingInput = `${jwsHeader}.${canonicalPayload}`
    const signature = new Uint8Array(Buffer.from(jwsSig, 'base64url'))

    const publicKey = await getPublicKey(presentation.proof.verificationMethod)

    checks.signatureValid = await ed.verifyAsync(
      signature,
      new TextEncoder().encode(signingInput),
      publicKey,
    )
  } catch {
    checks.signatureValid = false
  }

  if (!checks.signatureValid) {
    return { valid: false, error: 'Invalid signature', checks }
  }

  return { valid: true, checks }
}
