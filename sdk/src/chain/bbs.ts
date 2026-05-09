/**
 * Chain-backed BBS+ methods.
 *
 * Wraps the chain's BBS+ JSON-RPC surface and the `CredentialIssueBbs`
 * transaction. Verification is delegated to the chain (`solidus_bbsVerifyProof`
 * and `solidus_bbsVerifyCredentialProof`) which runs the IRTF
 * `draft-irtf-cfrg-bbs-signatures` ProofVerify routine via zkryptium.
 *
 * Client-side proof generation lives in a separate `@solidus-network/bbs`
 * package (still in design) so this SDK does not require WASM.
 */
import type { RpcClient } from './rpc.js'
import type { ChainConfig } from './index.js'
import { buildTransaction, getAddressFromKey, bytesToHex } from './transaction.js'

// ---------- public types ----------

/**
 * One disclosed message in a BBS+ proof. `index` is the zero-based position
 * in the original signed vector. `message` is hex-encoded bytes.
 */
export interface BbsDisclosedMessage {
  index: number
  message: string
}

/**
 * Result of verifying a BBS+ proof against an on-chain credential.
 *
 * - `proofValid` is the cryptographic verdict (true iff the proof was generated
 *   from a signature over the disclosed messages by the recorded BBS pubkey).
 * - `valid` combines `proofValid` with revocation: `true` iff the proof is
 *   cryptographically valid AND the credential is not revoked.
 * - `isBbs` is `false` for unknown credentials and for credentials issued via
 *   the legacy (Ed25519/opaque-hash) `CredentialIssue` path.
 */
export interface BbsCredentialProofResult {
  valid: boolean
  proofValid: boolean
  isBbs: boolean
  revoked: boolean
  credential: BbsCredentialRecord | null
}

/**
 * On-chain credential record with optional BBS+ metadata.
 */
export interface BbsCredentialRecord {
  id: string
  issuer_did: string
  subject_did: string
  credential_type: string
  hash: string
  issued_ms: number
  revoked: boolean
  revoked_ms: number | null
  bbs_pubkey?: string | null
  bbs_message_count?: number | null
}

interface RpcReceipt {
  tx_hash: string
  status: string
  block_height: number
  fee_paid: number
  events: Array<{ type: string; credentialId?: string; [key: string]: unknown }>
}

// ---------- helpers ----------

async function pollReceipt(rpc: RpcClient, txHash: string): Promise<RpcReceipt> {
  const maxAttempts = 20
  for (let i = 0; i < maxAttempts; i++) {
    const receipt = await rpc.call<RpcReceipt | null>('solidus_getReceipt', [txHash])
    if (receipt) return receipt
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Transaction ${txHash} not confirmed after 10 seconds`)
}

function validateDisclosed(disclosed: BbsDisclosedMessage[], totalMessageCount: number): void {
  const seen = new Set<number>()
  for (const dm of disclosed) {
    if (!Number.isInteger(dm.index) || dm.index < 0) {
      throw new Error(`disclosed index must be a non-negative integer, got ${dm.index}`)
    }
    if (dm.index >= totalMessageCount) {
      throw new Error(
        `disclosed index ${dm.index} >= totalMessageCount ${totalMessageCount}`,
      )
    }
    if (seen.has(dm.index)) {
      throw new Error(`duplicate disclosed index ${dm.index}`)
    }
    seen.add(dm.index)
    if (!/^[0-9a-f]*$/i.test(dm.message) || dm.message.length % 2 !== 0) {
      throw new Error(`disclosed message at index ${dm.index} is not valid hex`)
    }
  }
}

// ---------- factory ----------

export function createChainBbs(rpc: RpcClient, config: ChainConfig) {
  return {
    /**
     * Issue a BBS+ credential by submitting a `CredentialIssueBbs` transaction.
     *
     * The caller must have already produced a BBS+ signature off-chain over
     * the message vector and committed to a 96-byte BLS12-381 G2 public key.
     * Only the public key, message count, and a BLAKE3 hash of the off-chain
     * payload are recorded on-chain.
     *
     * @returns the transaction hash and the on-chain credential id.
     */
    async issueCredential(params: {
      issuerPrivateKey: string
      subjectDid: string
      credentialType: string
      payloadHash: Uint8Array
      bbsPubkey: Uint8Array
      bbsMessageCount: number
    }): Promise<{ txHash: string; credentialId: string; receipt: RpcReceipt }> {
      if (params.payloadHash.length !== 32) {
        throw new Error(`payloadHash must be 32 bytes, got ${params.payloadHash.length}`)
      }
      if (params.bbsPubkey.length !== 96) {
        throw new Error(`bbsPubkey must be 96 bytes, got ${params.bbsPubkey.length}`)
      }
      if (
        !Number.isInteger(params.bbsMessageCount) ||
        params.bbsMessageCount < 1 ||
        params.bbsMessageCount > 64
      ) {
        throw new Error(`bbsMessageCount must be an integer in [1, 64], got ${params.bbsMessageCount}`)
      }

      const address = await getAddressFromKey(params.issuerPrivateKey)
      const nonce = await rpc.call<number>('solidus_getNonce', [address])

      const payload = {
        CredentialIssueBbs: {
          subject_did: params.subjectDid,
          credential_type: params.credentialType,
          hash: Array.from(params.payloadHash),
          bbs_pubkey: Array.from(params.bbsPubkey),
          bbs_message_count: params.bbsMessageCount,
        },
      }

      const tx = await buildTransaction(params.issuerPrivateKey, nonce, payload)
      const txHash = await rpc.call<string>('solidus_sendTransaction', [JSON.stringify(tx)])
      const receipt = await pollReceipt(rpc, txHash)

      if (!receipt.status.startsWith('success')) {
        throw new Error(`CredentialIssueBbs failed: ${receipt.status}`)
      }

      const issuedEvent = receipt.events.find((e) => e.type === 'CredentialIssued')
      const credentialId =
        (issuedEvent?.credentialId as string | undefined) ??
        `urn:solidus:credential:${txHash}`

      return { txHash, credentialId, receipt }
    },

    /**
     * Verify a BBS+ selective-disclosure proof statelessly. Delegates to
     * `solidus_bbsVerifyProof` so the cryptographic check runs on the chain
     * node (zkryptium) — no client-side BBS library required.
     */
    async verifyProof(params: {
      proofHex: string
      pubkeyHex: string
      headerHex?: string
      phHex?: string
      disclosedMessages: BbsDisclosedMessage[]
      totalMessageCount: number
    }): Promise<boolean> {
      validateDisclosed(params.disclosedMessages, params.totalMessageCount)
      return rpc.call<boolean>('solidus_bbsVerifyProof', [
        params.proofHex,
        params.pubkeyHex,
        params.headerHex ?? '',
        params.phHex ?? '',
        params.disclosedMessages,
        params.totalMessageCount,
      ])
    },

    /**
     * Verify a BBS+ proof against an on-chain credential record. The chain
     * looks up the credential by `credentialId`, pulls `bbs_pubkey` and
     * `bbs_message_count` from chain state, and runs the proof check.
     *
     * Combines proof validity with revocation status: `valid === true` iff
     * the proof is cryptographically valid AND the credential is not revoked.
     */
    async verifyCredentialProof(params: {
      credentialId: string
      proofHex: string
      headerHex?: string
      phHex?: string
      disclosedMessages: BbsDisclosedMessage[]
    }): Promise<BbsCredentialProofResult> {
      // Indices are validated against on-chain message count by the chain;
      // we only validate hex shape here.
      for (const dm of params.disclosedMessages) {
        if (!Number.isInteger(dm.index) || dm.index < 0) {
          throw new Error(`disclosed index must be a non-negative integer, got ${dm.index}`)
        }
        if (!/^[0-9a-f]*$/i.test(dm.message) || dm.message.length % 2 !== 0) {
          throw new Error(`disclosed message at index ${dm.index} is not valid hex`)
        }
      }

      interface RpcResult {
        valid: boolean
        proof_valid: boolean
        is_bbs: boolean
        revoked: boolean
        credential: BbsCredentialRecord | null
      }

      const result = await rpc.call<RpcResult>('solidus_bbsVerifyCredentialProof', [
        params.credentialId,
        params.proofHex,
        params.headerHex ?? '',
        params.phHex ?? '',
        params.disclosedMessages,
      ])

      return {
        valid: result.valid,
        proofValid: result.proof_valid,
        isBbs: result.is_bbs,
        revoked: result.revoked,
        credential: result.credential,
      }
    },
  }
}

// ---------- utility re-exports ----------

/**
 * Convenience helper: convert raw bytes to hex.
 */
export const toHex = bytesToHex

/**
 * Convenience helper: encode a UTF-8 string as hex bytes (for use as a
 * disclosed-message field or header/ph value).
 */
export function utf8ToHex(s: string): string {
  return bytesToHex(new TextEncoder().encode(s))
}
