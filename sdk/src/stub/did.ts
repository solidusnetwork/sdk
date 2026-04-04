import { randomUUID } from 'node:crypto'
import type { DID, DIDDocument } from '@solidus/types'
import { getSql } from './db.js'
import { encodePublicKey } from './crypto.js'

type DidRow = {
  did: string
  public_key: string
  controller: string
  created_at: Date
  updated_at: Date
}

export async function didCreate(publicKeyHex: string): Promise<DID> {
  const sql = getSql()
  const id = `did:solidus:stub:${randomUUID()}`
  const now = new Date().toISOString()

  await sql`
    INSERT INTO stub_dids (did, public_key, controller, network)
    VALUES (${id}, ${publicKeyHex}, ${id}, 'stub')
  `

  return { id, controller: id, created: now, updated: now, network: 'stub' }
}

export async function didResolve(did: string): Promise<DIDDocument | null> {
  const sql = getSql()
  const rows = await sql<DidRow[]>`
    SELECT did, public_key, controller, created_at, updated_at
    FROM stub_dids
    WHERE did = ${did} AND deactivated = false
  `
  if (rows.length === 0) return null

  const row = rows[0]!
  const vmId = `${row.did}#key-1`

  return {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1',
    ],
    id: row.did,
    controller: row.controller,
    verificationMethod: [
      {
        id: vmId,
        type: 'Ed25519VerificationKey2020',
        controller: row.did,
        publicKeyMultibase: encodePublicKey(row.public_key),
      },
    ],
    authentication: [vmId],
    assertionMethod: [vmId],
    created: row.created_at.toISOString(),
    updated: row.updated_at.toISOString(),
  }
}

export async function didDeactivate(did: string, _signerKey: string): Promise<void> {
  const sql = getSql()
  await sql`
    UPDATE stub_dids SET deactivated = true, updated_at = now() WHERE did = ${did}
  `
}
