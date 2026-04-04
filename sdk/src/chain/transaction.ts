/**
 * Transaction building and Ed25519 signing for the Solidus chain.
 *
 * Matches the Rust chain's expected format:
 *   - sender_pubkey: [u8; 32]  (JSON array of numbers)
 *   - nonce: u64
 *   - payload: TxPayload       (serde tagged enum, e.g. {"DidCreate": {...}})
 *   - signature: [u8; 64]      (JSON array of numbers)
 *
 * signing_bytes = BLAKE3(sender_pubkey || nonce_le_bytes || serde_json(payload))
 */
import * as ed from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha512'
import { blake3 } from '@noble/hashes/blake3'
import bs58 from 'bs58'

// Configure ed25519 v2 to use sha512 for sync operations
ed.etc.sha512Sync = (...m: Uint8Array[]) => sha512(ed.etc.concatBytes(...m))

export interface ChainTransaction {
  sender_pubkey: number[] // 32-byte array as JSON numbers
  nonce: number
  payload: unknown // TxPayload variant (serde tagged enum)
  signature: number[] // 64-byte array as JSON numbers
}

/**
 * Build and sign a transaction for the Solidus chain.
 */
export async function buildTransaction(
  privateKeyHex: string,
  nonce: number,
  payload: unknown,
): Promise<ChainTransaction> {
  const privateKey = hexToBytes(privateKeyHex)
  const publicKey = await ed.getPublicKeyAsync(privateKey)

  // Build signing bytes: BLAKE3(pubkey || nonce_le || json(payload))
  const nonceBytes = new Uint8Array(8)
  new DataView(nonceBytes.buffer).setBigUint64(0, BigInt(nonce), true) // little-endian
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload))

  const combined = new Uint8Array(publicKey.length + nonceBytes.length + payloadBytes.length)
  combined.set(publicKey, 0)
  combined.set(nonceBytes, publicKey.length)
  combined.set(payloadBytes, publicKey.length + nonceBytes.length)

  const signingHash = blake3(combined)
  const signature = await ed.signAsync(signingHash, privateKey)

  return {
    sender_pubkey: Array.from(publicKey),
    nonce,
    payload,
    signature: Array.from(signature),
  }
}

/**
 * Derive the Solidus address from a private key.
 * Algorithm: BLAKE3(publicKey) -> take first 20 bytes -> base58 encode.
 * Matches Rust Address::from_public_key.
 */
export async function getAddressFromKey(privateKeyHex: string): Promise<string> {
  const privateKey = hexToBytes(privateKeyHex)
  const publicKey = await ed.getPublicKeyAsync(privateKey)
  return addressFromPublicKey(publicKey)
}

/**
 * Derive the Solidus address from a raw public key (Uint8Array).
 */
export function addressFromPublicKey(publicKey: Uint8Array): string {
  const hash = blake3(publicKey)
  const addressBytes = hash.slice(0, 20)
  return bs58.encode(addressBytes)
}

// ---------- hex utilities ----------

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Convert a hex-encoded public key to a number[] array (for JSON payloads).
 */
export function hexToArray(hex: string): number[] {
  return Array.from(hexToBytes(hex))
}
