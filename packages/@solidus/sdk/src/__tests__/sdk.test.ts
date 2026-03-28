import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createSdk, generateKeypair, runMigrations, closeConnection } from '../index.js'

const sdk = createSdk({ mode: 'stub' })

beforeAll(async () => {
  await runMigrations()
})

afterAll(async () => {
  await closeConnection()
})

describe('crypto', () => {
  it('generates a valid Ed25519 keypair', async () => {
    const kp = await generateKeypair()
    expect(kp.privateKey).toHaveLength(64)
    expect(kp.publicKey).toHaveLength(64)
  })
})

describe('DID operations', () => {
  let testDid: string

  it('creates a DID', async () => {
    const kp = await generateKeypair()
    const did = await sdk.did.create(kp.publicKey)
    expect(did.id).toMatch(/^did:solidus:stub:/)
    expect(did.network).toBe('stub')
    testDid = did.id
  })

  it('resolves a DID document', async () => {
    const doc = await sdk.did.resolve(testDid)
    expect(doc).not.toBeNull()
    expect(doc!.id).toBe(testDid)
    expect(doc!.verificationMethod[0]!.publicKeyMultibase).toMatch(/^z/)
  })

  it('returns null for unknown DID', async () => {
    const doc = await sdk.did.resolve('did:solidus:stub:nonexistent-000')
    expect(doc).toBeNull()
  })

  it('deactivates a DID', async () => {
    const kp = await generateKeypair()
    const did = await sdk.did.create(kp.publicKey)
    await sdk.did.deactivate(did.id, kp.privateKey)
    expect(await sdk.did.resolve(did.id)).toBeNull()
  })
})

describe('Credential operations', () => {
  let subjectDid: string
  let issuerDid: string
  let issuerPrivateKey: string
  let vcId: string

  beforeAll(async () => {
    const subjectKp = await generateKeypair()
    const issuerKp = await generateKeypair()
    subjectDid = (await sdk.did.create(subjectKp.publicKey)).id
    issuerDid = (await sdk.did.create(issuerKp.publicKey)).id
    issuerPrivateKey = issuerKp.privateKey
  })

  it('issues a KYC credential', async () => {
    const vc = await sdk.credentials.issue({
      subjectDid,
      issuerDid,
      issuerPrivateKey,
      type: ['VerifiableCredential', 'KYCCredential'],
      claims: { kycLevel: 2, verifiedAt: new Date().toISOString() },
      expiresInDays: 365,
    })
    expect(vc.id).toMatch(/^vc:solidus:stub:/)
    expect(vc.credentialSubject.id).toBe(subjectDid)
    expect(vc.proof.type).toBe('Ed25519Signature2020')
    vcId = vc.id
  })

  it('verifies a valid credential', async () => {
    const result = await sdk.credentials.verify(vcId)
    expect(result.valid).toBe(true)
    expect(result.checks.signature).toBe(true)
    expect(result.checks.expiry).toBe(true)
    expect(result.checks.revocation).toBe(true)
  })

  it('returns invalid for unknown credential', async () => {
    const result = await sdk.credentials.verify('vc:solidus:stub:nonexistent')
    expect(result.valid).toBe(false)
  })

  it('queries credentials by subject DID', async () => {
    const vcs = await sdk.credentials.query(subjectDid)
    expect(vcs.length).toBeGreaterThan(0)
    expect(vcs[0]!.credentialSubject.id).toBe(subjectDid)
  })

  it('revokes a credential', async () => {
    const kp = await generateKeypair()
    const did = (await sdk.did.create(kp.publicKey)).id
    const vc = await sdk.credentials.issue({
      subjectDid: did, issuerDid, issuerPrivateKey,
      type: ['VerifiableCredential', 'KYCCredential'],
      claims: { kycLevel: 1 },
    })
    await sdk.credentials.revoke(vc.id, issuerPrivateKey)
    const result = await sdk.credentials.verify(vc.id)
    expect(result.valid).toBe(false)
    expect(result.checks.revocation).toBe(false)
  })
})

describe('Auth', () => {
  it('creates a challenge', async () => {
    const challenge = await sdk.auth.createChallenge('verify.solidus.network')
    expect(typeof challenge).toBe('string')
    expect(challenge.length).toBeGreaterThan(0)
  })
})
