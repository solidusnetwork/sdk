/**
 * Chain-backed DID methods.
 *
 * Maps the SolidusSDK.did interface to JSON-RPC calls against the
 * Solidus chain node. DID creation and deactivation submit signed
 * transactions; DID resolution is a read-only RPC call.
 */
import type { DID, DIDDocument, VerificationMethod } from '@solidus/types'
import type { RpcClient } from './rpc.js'
import type { ChainConfig } from './index.js'
import {
  buildTransaction,
  getAddressFromKey,
  addressFromPublicKey,
  hexToBytes,
  hexToArray,
  bytesToHex,
} from './transaction.js'
import * as ed from '@noble/ed25519'
import bs58 from 'bs58'

// ---------- RPC response types (matching Rust RpcDidDocument) ----------

interface RpcVerificationMethod {
  id: string
  type: string
  controller: string
  publicKeyHex: string
}

interface RpcDidDocument {
  context: string
  id: string
  controller: string
  verification_method: RpcVerificationMethod[]
  authentication: string[]
  /** Added 2026-05-09. Optional for backward compat with documents
   *  written before the chain stored the four extra W3C relationships. */
  assertion_method?: string[]
  key_agreement?: string[]
  capability_invocation?: string[]
  capability_delegation?: string[]
  service: unknown[]
  active: boolean
  created_ms: number
  updated_ms: number
}

/**
 * W3C DID Resolution result — preserves the deactivated state separately
 * from the document. Mirrors the shape defined in
 * https://www.w3.org/TR/did-resolution/#did-resolution-result.
 */
export interface DIDResolutionResult {
  didDocument: DIDDocument | null
  didDocumentMetadata: {
    deactivated?: boolean
    created?: string
    updated?: string
  }
  didResolutionMetadata: {
    contentType: 'application/did+json'
    error?: 'notFound' | 'invalidDid'
  }
}

interface RpcReceipt {
  tx_hash: string
  status: string
  block_height: number
  fee_paid: number
  events: unknown[]
}

// ---------- helpers ----------

/**
 * Build the DID string from network and address.
 * Format: did:solidus:{network}:{base58_address}
 */
function buildDidString(network: string, address: string): string {
  return `did:solidus:${network}:${address}`
}

/**
 * Poll for a transaction receipt, retrying every 500ms for up to 10 seconds.
 */
async function pollReceipt(rpc: RpcClient, txHash: string): Promise<RpcReceipt> {
  const maxAttempts = 20 // 20 * 500ms = 10s
  for (let i = 0; i < maxAttempts; i++) {
    const receipt = await rpc.call<RpcReceipt | null>('solidus_getReceipt', [txHash])
    if (receipt) return receipt
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Transaction ${txHash} not confirmed after 10 seconds`)
}

/**
 * Convert an RPC DID document to the W3C DIDDocument format expected
 * by the SolidusSDK interface.
 */
function mapToW3CDIDDocument(doc: RpcDidDocument): DIDDocument {
  const verificationMethod: VerificationMethod[] = doc.verification_method.map((vm) => ({
    id: vm.id,
    type: 'Ed25519VerificationKey2020',
    controller: vm.controller,
    publicKeyMultibase: 'z' + bs58.encode(hexToBytes(vm.publicKeyHex)),
  }))

  // Use chain-stored relationship arrays when present; for legacy
  // documents (chain version < 2026-05-09) fall back to mirroring
  // `authentication` for `assertionMethod`/`capabilityInvocation`/
  // `capabilityDelegation` (the conservative W3C interpretation that
  // matches how `build_did_document` populates these defaults today).
  const authentication = doc.authentication
  const assertionMethod = doc.assertion_method ?? doc.authentication
  const capabilityInvocation = doc.capability_invocation ?? doc.authentication
  const capabilityDelegation = doc.capability_delegation ?? doc.authentication
  const keyAgreement = doc.key_agreement ?? []

  return {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1',
    ],
    id: doc.id,
    controller: doc.controller,
    verificationMethod,
    authentication,
    assertionMethod,
    keyAgreement,
    capabilityInvocation,
    capabilityDelegation,
    created: new Date(doc.created_ms).toISOString(),
    updated: new Date(doc.updated_ms).toISOString(),
  }
}

// ---------- factory ----------

export function createChainDid(rpc: RpcClient, config: ChainConfig) {
  return {
    async create(publicKey: string): Promise<DID> {
      // 1. Derive sender address from the signing key
      const senderAddress = config.signerAddress ?? (await getAddressFromKey(config.signerPrivateKey))

      // 2. Get current nonce
      const nonce = await rpc.call<number>('solidus_getNonce', [senderAddress])

      // 3. Build DidCreate payload (Rust serde tagged enum format)
      const payload = {
        DidCreate: {
          public_key: hexToArray(publicKey),
          service_endpoints: [],
        },
      }

      // 4. Build and sign transaction
      const tx = await buildTransaction(config.signerPrivateKey, nonce, payload)

      // 5. Submit via RPC
      const txHash = await rpc.call<string>('solidus_sendTransaction', [JSON.stringify(tx)])

      // 6. Poll for receipt
      const receipt = await pollReceipt(rpc, txHash)
      if (!receipt.status.startsWith('success')) {
        throw new Error(`DidCreate failed: ${receipt.status}`)
      }

      // 7. Build DID string from the public key that was registered
      // The chain creates the DID using the public key's address
      const pubKeyBytes = hexToBytes(publicKey)
      const didAddress = addressFromPublicKey(pubKeyBytes)
      const did = buildDidString(config.network, didAddress)

      // 8. Resolve the created DID to get timestamps
      const doc = await rpc.call<RpcDidDocument | null>('solidus_didResolve', [did])
      const now = new Date().toISOString()

      return {
        id: did,
        controller: did,
        created: doc ? new Date(doc.created_ms).toISOString() : now,
        updated: doc ? new Date(doc.updated_ms).toISOString() : now,
        network: config.network,
      }
    },

    async resolve(did: string): Promise<DIDDocument | null> {
      // BACKWARD COMPAT: returns null for deactivated DIDs. Use
      // resolveWithMetadata() for spec-conformant resolution that
      // distinguishes "not found" from "deactivated".
      const doc = await rpc.call<RpcDidDocument | null>('solidus_didResolve', [did])
      if (!doc) return null
      if (!doc.active) return null
      return mapToW3CDIDDocument(doc)
    },

    /**
     * Spec-conformant W3C DID Resolution. Returns the full
     * {@link DIDResolutionResult} including `didDocumentMetadata.deactivated`
     * for tombstoned DIDs, instead of folding the deactivated state into
     * a `null` document. Use this when interoperating with W3C DID Core
     * tooling that distinguishes "not found" from "deactivated".
     *
     * @see https://www.w3.org/TR/did-resolution/#did-resolution-result
     */
    async resolveWithMetadata(did: string): Promise<DIDResolutionResult> {
      const doc = await rpc.call<RpcDidDocument | null>('solidus_didResolve', [did])
      if (!doc) {
        return {
          didDocument: null,
          didDocumentMetadata: {},
          didResolutionMetadata: {
            contentType: 'application/did+json',
            error: 'notFound',
          },
        }
      }
      const didDocument = mapToW3CDIDDocument(doc)
      return {
        didDocument,
        didDocumentMetadata: {
          deactivated: !doc.active,
          created: new Date(doc.created_ms).toISOString(),
          updated: new Date(doc.updated_ms).toISOString(),
        },
        didResolutionMetadata: {
          contentType: 'application/did+json',
        },
      }
    },

    async deactivate(did: string, signerKey: string): Promise<void> {
      // Derive address from the provided signing key
      const address = await getAddressFromKey(signerKey)
      const nonce = await rpc.call<number>('solidus_getNonce', [address])

      const payload = { DidDeactivate: { did } }
      const tx = await buildTransaction(signerKey, nonce, payload)

      const txHash = await rpc.call<string>('solidus_sendTransaction', [JSON.stringify(tx)])
      const receipt = await pollReceipt(rpc, txHash)
      if (!receipt.status.startsWith('success')) {
        throw new Error(`DidDeactivate failed: ${receipt.status}`)
      }
    },
  }
}
