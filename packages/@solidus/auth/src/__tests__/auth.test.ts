import { describe, it, expect } from 'vitest'
import * as ed from '@noble/ed25519'
import { createChallenge } from '../challenge.js'
import { verifyPresentation } from '../verify.js'
import type { VerifiablePresentation } from '../verify.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal signed presentation for testing */
async function buildSignedPresentation(
  holderDid: string,
  nonce: string,
  privateKey: Uint8Array,
): Promise<VerifiablePresentation> {
  const presentation = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiablePresentation'],
    holder: holderDid,
    proof: {
      type: 'Ed25519Signature2020',
      created: new Date().toISOString(),
      challenge: nonce,
      proofPurpose: 'authentication',
      verificationMethod: `${holderDid}#key-1`,
      jws: '',
    },
  }

  const { proof: _proof, ...withoutProof } = presentation
  const canonicalPayload = Buffer.from(JSON.stringify(withoutProof)).toString('base64url')
  const jwsHeader = Buffer.from(JSON.stringify({ alg: 'EdDSA' })).toString('base64url')
  const signingInput = `${jwsHeader}.${canonicalPayload}`
  const sig = await ed.signAsync(new TextEncoder().encode(signingInput), privateKey)
  presentation.proof.jws = `${jwsHeader}..${Buffer.from(sig).toString('base64url')}`

  return presentation
}

// ---------------------------------------------------------------------------
// createChallenge
// ---------------------------------------------------------------------------

describe('createChallenge', () => {
  it('creates a challenge with required fields', () => {
    const challenge = createChallenge('did:solidus:alice')
    expect(challenge.did).toBe('did:solidus:alice')
    expect(challenge.nonce).toHaveLength(64)
    expect(challenge.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/)
    expect(typeof challenge.issuedAt).toBe('string')
    expect(typeof challenge.expiresAt).toBe('string')
  })

  it('expiresAt is after issuedAt', () => {
    const challenge = createChallenge('did:solidus:alice')
    expect(new Date(challenge.expiresAt).getTime()).toBeGreaterThan(
      new Date(challenge.issuedAt).getTime(),
    )
  })

  it('respects custom ttlSeconds', () => {
    const challenge = createChallenge('did:solidus:alice', 120)
    const diffSeconds =
      (new Date(challenge.expiresAt).getTime() - new Date(challenge.issuedAt).getTime()) / 1000
    expect(diffSeconds).toBe(120)
  })

  it('generates unique nonces', () => {
    const c1 = createChallenge('did:solidus:alice')
    const c2 = createChallenge('did:solidus:alice')
    expect(c1.nonce).not.toBe(c2.nonce)
    expect(c1.id).not.toBe(c2.id)
  })
})

// ---------------------------------------------------------------------------
// verifyPresentation
// ---------------------------------------------------------------------------

describe('verifyPresentation', () => {
  it('returns valid: true for a correctly signed presentation', async () => {
    const privateKey = ed.utils.randomPrivateKey()
    const publicKey = await ed.getPublicKeyAsync(privateKey)
    const challenge = createChallenge('did:solidus:alice')

    const presentation = await buildSignedPresentation(
      'did:solidus:alice',
      challenge.nonce,
      privateKey,
    )

    const result = await verifyPresentation(
      challenge,
      presentation,
      async () => publicKey,
    )

    expect(result.valid).toBe(true)
    expect(result.checks.notExpired).toBe(true)
    expect(result.checks.holderMatches).toBe(true)
    expect(result.checks.nonceMatches).toBe(true)
    expect(result.checks.signatureValid).toBe(true)
  })

  it('fails for expired challenge', async () => {
    const challenge = createChallenge('did:solidus:alice', -1)
    const presentation: VerifiablePresentation = {
      '@context': [],
      type: ['VerifiablePresentation'],
      holder: 'did:solidus:alice',
      proof: {
        type: 'Ed25519Signature2020',
        created: new Date().toISOString(),
        challenge: challenge.nonce,
        proofPurpose: 'authentication',
        verificationMethod: 'did:solidus:alice#key-1',
        jws: 'aaa..bbb',
      },
    }
    const result = await verifyPresentation(challenge, presentation, async () => new Uint8Array(32))
    expect(result.valid).toBe(false)
    expect(result.checks.notExpired).toBe(false)
  })

  it('fails when holder DID does not match', async () => {
    const challenge = createChallenge('did:solidus:alice')
    const presentation: VerifiablePresentation = {
      '@context': [],
      type: ['VerifiablePresentation'],
      holder: 'did:solidus:bob',
      proof: {
        type: '',
        created: '',
        challenge: challenge.nonce,
        proofPurpose: '',
        verificationMethod: 'did:solidus:bob#key-1',
        jws: 'aaa..bbb',
      },
    }
    const result = await verifyPresentation(challenge, presentation, async () => new Uint8Array(32))
    expect(result.valid).toBe(false)
    expect(result.checks.holderMatches).toBe(false)
  })

  it('fails when nonce does not match', async () => {
    const challenge = createChallenge('did:solidus:alice')
    const presentation: VerifiablePresentation = {
      '@context': [],
      type: ['VerifiablePresentation'],
      holder: 'did:solidus:alice',
      proof: {
        type: '',
        created: '',
        challenge: 'wrong-nonce',
        proofPurpose: '',
        verificationMethod: 'did:solidus:alice#key-1',
        jws: 'aaa..bbb',
      },
    }
    const result = await verifyPresentation(challenge, presentation, async () => new Uint8Array(32))
    expect(result.valid).toBe(false)
    expect(result.checks.nonceMatches).toBe(false)
  })

  it('fails when signature is invalid', async () => {
    const privateKey = ed.utils.randomPrivateKey()
    const wrongKey = ed.utils.randomPrivateKey()
    const wrongPublic = await ed.getPublicKeyAsync(wrongKey)
    const challenge = createChallenge('did:solidus:alice')

    const presentation = await buildSignedPresentation(
      'did:solidus:alice',
      challenge.nonce,
      privateKey,
    )

    const result = await verifyPresentation(
      challenge,
      presentation,
      async () => wrongPublic,
    )
    expect(result.valid).toBe(false)
    expect(result.checks.signatureValid).toBe(false)
  })
})
