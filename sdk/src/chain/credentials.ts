/**
 * Chain-backed credential methods.
 *
 * Maps the SolidusSDK.credentials interface to JSON-RPC calls against the
 * Solidus chain node. Credential issuance and revocation submit signed
 * transactions; verification and querying are read-only RPC calls.
 */
import type { VerifiableCredential, IssueCredentialParams, VerificationResult } from '@solidus/types'
import type { RpcClient } from './rpc.js'
import type { ChainConfig } from './index.js'
import { buildTransaction, getAddressFromKey, hexToBytes, bytesToHex } from './transaction.js'
import { blake3 } from '@noble/hashes/blake3'

// ---------- RPC response types (matching Rust RPC types) ----------

interface RpcCredentialRecord {
  id: string
  issuer_did: string
  subject_did: string
  credential_type: string
  hash: string // hex-encoded BLAKE3 hash
  issued_ms: number
  revoked: boolean
  revoked_ms: number | null
}

interface RpcCredentialVerifyResult {
  valid: boolean
  credential: RpcCredentialRecord | null
  revoked: boolean
}

interface RpcReceipt {
  tx_hash: string
  status: string
  block_height: number
  fee_paid: number
  events: Array<{ type: string; credentialId?: string; [key: string]: unknown }>
}

// ---------- helpers ----------

/**
 * Map the user-facing credential type strings to the chain's CredentialType
 * enum values (Rust serde representation).
 */
function mapCredentialType(types: string[]): string {
  // The chain expects simple enum variants: "Email", "Phone", "KycL1", etc.
  // Map from common W3C-style type names to chain enum values
  const typeMap: Record<string, string> = {
    EmailCredential: 'Email',
    PhoneCredential: 'Phone',
    KycLevel1Credential: 'KycL1',
    KycLevel2Credential: 'KycL2',
    KycLevel3Credential: 'KycL3',
    AgeCredential: 'Age',
    ReputationCredential: 'Reputation',
    // Also accept the raw chain names
    Email: 'Email',
    Phone: 'Phone',
    KycL1: 'KycL1',
    KycL2: 'KycL2',
    KycL3: 'KycL3',
    Age: 'Age',
    Reputation: 'Reputation',
  }

  // Find the first matching type (skip "VerifiableCredential" base type)
  for (const t of types) {
    const mapped = typeMap[t]
    if (mapped) return mapped
  }

  // Default to Email if no recognized type
  return 'Email'
}

/**
 * Build a BLAKE3 hash of the off-chain credential payload.
 */
function hashCredentialPayload(params: IssueCredentialParams): Uint8Array {
  const payload = JSON.stringify({
    subject: params.subjectDid,
    issuer: params.issuerDid,
    type: params.type,
    claims: params.claims,
  })
  return blake3(new TextEncoder().encode(payload))
}

/**
 * Convert an RpcCredentialRecord to the W3C VerifiableCredential format.
 */
function recordToVC(record: RpcCredentialRecord): VerifiableCredential {
  return {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: record.id,
    type: ['VerifiableCredential', record.credential_type + 'Credential'],
    issuer: record.issuer_did,
    issuanceDate: new Date(record.issued_ms).toISOString(),
    credentialSubject: { id: record.subject_did },
    proof: {
      type: 'Ed25519Signature2020',
      created: new Date(record.issued_ms).toISOString(),
      verificationMethod: `${record.issuer_did}#key-1`,
      proofPurpose: 'assertionMethod',
      proofValue: record.hash, // On-chain, the proof is the hash itself
    },
  }
}

/**
 * Poll for a transaction receipt, retrying every 500ms for up to 10 seconds.
 */
async function pollReceipt(rpc: RpcClient, txHash: string): Promise<RpcReceipt> {
  const maxAttempts = 20
  for (let i = 0; i < maxAttempts; i++) {
    const receipt = await rpc.call<RpcReceipt | null>('solidus_getReceipt', [txHash])
    if (receipt) return receipt
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Transaction ${txHash} not confirmed after 10 seconds`)
}

// ---------- factory ----------

export function createChainCredentials(rpc: RpcClient, config: ChainConfig) {
  return {
    async issue(params: IssueCredentialParams): Promise<VerifiableCredential> {
      // Use the issuer's private key to sign the transaction
      const signerKey = params.issuerPrivateKey
      const address = await getAddressFromKey(signerKey)
      const nonce = await rpc.call<number>('solidus_getNonce', [address])

      // Compute BLAKE3 hash of the credential payload
      const payloadHash = hashCredentialPayload(params)

      // Build CredentialIssue payload (Rust serde tagged enum)
      const payload = {
        CredentialIssue: {
          subject_did: params.subjectDid,
          credential_type: mapCredentialType(params.type),
          hash: Array.from(payloadHash),
        },
      }

      // Build and sign transaction
      const tx = await buildTransaction(signerKey, nonce, payload)

      // Submit and wait for receipt
      const txHash = await rpc.call<string>('solidus_sendTransaction', [JSON.stringify(tx)])
      const receipt = await pollReceipt(rpc, txHash)
      if (!receipt.status.startsWith('success')) {
        throw new Error(`CredentialIssue failed: ${receipt.status}`)
      }

      // Extract credential ID from the CredentialIssued event
      const issuedEvent = receipt.events.find((e) => e.type === 'CredentialIssued')
      const credentialId = issuedEvent?.credentialId ?? `urn:solidus:credential:${txHash}`

      // Query back the credential to get the full record
      const records = await rpc.call<RpcCredentialRecord[]>(
        'solidus_credentialsBySubject',
        [params.subjectDid],
      )
      const record = records.find((r) => r.id === credentialId)

      if (record) {
        return recordToVC(record)
      }

      // Fallback: construct the VC from what we know
      const now = new Date()
      const expirationDate = params.expiresInDays
        ? new Date(now.getTime() + params.expiresInDays * 86_400_000).toISOString()
        : undefined

      return {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        id: credentialId,
        type: params.type,
        issuer: params.issuerDid,
        issuanceDate: now.toISOString(),
        ...(expirationDate ? { expirationDate } : {}),
        credentialSubject: { id: params.subjectDid, ...params.claims },
        proof: {
          type: 'Ed25519Signature2020',
          created: now.toISOString(),
          verificationMethod: `${params.issuerDid}#key-1`,
          proofPurpose: 'assertionMethod',
          proofValue: bytesToHex(payloadHash),
        },
      }
    },

    async verify(vcId: string): Promise<VerificationResult> {
      const result = await rpc.call<RpcCredentialVerifyResult | null>(
        'solidus_credentialVerify',
        [vcId],
      )

      if (!result) {
        return {
          valid: false,
          error: 'Credential not found',
          checks: { signature: false, expiry: false, revocation: false },
        }
      }

      return {
        valid: result.valid,
        ...(result.credential ? { credentialId: result.credential.id } : {}),
        checks: {
          signature: true, // Chain validates signatures at submission time
          expiry: true, // Chain credentials don't expire on-chain
          revocation: !result.revoked,
        },
      }
    },

    async revoke(credentialId: string, issuerKey: string): Promise<void> {
      const address = await getAddressFromKey(issuerKey)
      const nonce = await rpc.call<number>('solidus_getNonce', [address])

      const payload = { CredentialRevoke: { credential_id: credentialId } }
      const tx = await buildTransaction(issuerKey, nonce, payload)

      const txHash = await rpc.call<string>('solidus_sendTransaction', [JSON.stringify(tx)])
      const receipt = await pollReceipt(rpc, txHash)
      if (!receipt.status.startsWith('success')) {
        throw new Error(`CredentialRevoke failed: ${receipt.status}`)
      }
    },

    async query(subjectDid: string): Promise<VerifiableCredential[]> {
      const records = await rpc.call<RpcCredentialRecord[]>(
        'solidus_credentialsBySubject',
        [subjectDid],
      )
      return records.filter((r) => !r.revoked).map(recordToVC)
    },
  }
}
