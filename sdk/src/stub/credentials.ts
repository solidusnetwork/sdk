import { randomUUID } from 'node:crypto'
import type postgres from 'postgres'
import type { VerifiableCredential, IssueCredentialParams, VerificationResult } from '@solidus/types'
import { getSql } from './db.js'
import { sign, verify as cryptoVerify } from './crypto.js'

type CredentialRow = {
  credential_id: string
  subject_did: string
  issuer_did: string
  type: string[]
  claims: Record<string, unknown>
  proof_value: string
  issued_at: Date
  expires_at: Date | null
  revoked: boolean
}

function rowToVC(row: CredentialRow): VerifiableCredential {
  return {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: row.credential_id,
    type: row.type,
    issuer: row.issuer_did,
    issuanceDate: row.issued_at.toISOString(),
    ...(row.expires_at && { expirationDate: row.expires_at.toISOString() }),
    credentialSubject: { id: row.subject_did, ...row.claims },
    proof: {
      type: 'Ed25519Signature2020',
      created: row.issued_at.toISOString(),
      verificationMethod: `${row.issuer_did}#key-1`,
      proofPurpose: 'assertionMethod',
      proofValue: row.proof_value,
    },
  }
}

function buildPayload(params: {
  credentialId: string
  subjectDid: string
  issuerDid: string
  claims: Record<string, unknown>
  issuedAt: string
}): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({
      id: params.credentialId,
      subject: params.subjectDid,
      issuer: params.issuerDid,
      claims: params.claims,
      issuedAt: params.issuedAt,
    }),
  )
}

export async function credentialsIssue(params: IssueCredentialParams): Promise<VerifiableCredential> {
  const sql = getSql()
  const credentialId = `vc:solidus:stub:${randomUUID()}`
  const now = new Date()
  const expiresAt = params.expiresInDays
    ? new Date(now.getTime() + params.expiresInDays * 86_400_000)
    : null

  const payload = buildPayload({
    credentialId,
    subjectDid: params.subjectDid,
    issuerDid: params.issuerDid,
    claims: params.claims,
    issuedAt: now.toISOString(),
  })
  const proofValue = await sign(payload, params.issuerPrivateKey)

  await sql`
    INSERT INTO stub_credentials
      (credential_id, subject_did, issuer_did, type, claims, proof_value, issued_at, expires_at)
    VALUES (
      ${credentialId}, ${params.subjectDid}, ${params.issuerDid},
      ${sql.array(params.type)}, ${sql.json(params.claims as postgres.JSONValue)},
      ${proofValue}, ${now}, ${expiresAt}
    )
  `

  return rowToVC({
    credential_id: credentialId,
    subject_did: params.subjectDid,
    issuer_did: params.issuerDid,
    type: params.type,
    claims: params.claims,
    proof_value: proofValue,
    issued_at: now,
    expires_at: expiresAt,
    revoked: false,
  })
}

export async function credentialsVerify(vcId: string): Promise<VerificationResult> {
  const sql = getSql()
  const rows = await sql<CredentialRow[]>`
    SELECT * FROM stub_credentials WHERE credential_id = ${vcId}
  `
  if (rows.length === 0) {
    return {
      valid: false,
      error: 'Credential not found',
      checks: { signature: false, expiry: false, revocation: false },
    }
  }
  const row = rows[0]!

  const notRevoked = !row.revoked
  const notExpired = !row.expires_at || row.expires_at > new Date()

  const issuerRows = await sql<Array<{ public_key: string }>>`
    SELECT public_key FROM stub_dids WHERE did = ${row.issuer_did}
  `

  let sigValid = false
  if (issuerRows.length > 0) {
    const payload = buildPayload({
      credentialId: row.credential_id,
      subjectDid: row.subject_did,
      issuerDid: row.issuer_did,
      claims: row.claims,
      issuedAt: row.issued_at.toISOString(),
    })
    sigValid = await cryptoVerify(payload, row.proof_value, issuerRows[0]!.public_key)
  }

  const valid = sigValid && notRevoked && notExpired
  return {
    valid,
    credentialId: vcId,
    checks: { signature: sigValid, expiry: notExpired, revocation: notRevoked },
  }
}

export async function credentialsRevoke(credentialId: string, _issuerKey: string): Promise<void> {
  const sql = getSql()
  await sql`
    UPDATE stub_credentials SET revoked = true, revoked_at = now()
    WHERE credential_id = ${credentialId}
  `
  await sql`
    INSERT INTO stub_revocations (credential_id) VALUES (${credentialId})
    ON CONFLICT DO NOTHING
  `
}

export async function credentialsQuery(subjectDid: string): Promise<VerifiableCredential[]> {
  const sql = getSql()
  const rows = await sql<CredentialRow[]>`
    SELECT * FROM stub_credentials
    WHERE subject_did = ${subjectDid} AND revoked = false
    ORDER BY issued_at DESC
  `
  return rows.map(rowToVC)
}
