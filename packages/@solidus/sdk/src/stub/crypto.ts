import * as ed from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha512'
import bs58 from 'bs58'

// @noble/ed25519 v2 requires sha512 to be configured for sync operations
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m))

export async function generateKeypair(): Promise<{ privateKey: string; publicKey: string }> {
  const privateKeyBytes = ed.utils.randomPrivateKey()
  const publicKeyBytes = await ed.getPublicKeyAsync(privateKeyBytes)
  return {
    privateKey: Buffer.from(privateKeyBytes).toString('hex'),
    publicKey: Buffer.from(publicKeyBytes).toString('hex'),
  }
}

export async function sign(message: Uint8Array, privateKeyHex: string): Promise<string> {
  const privateKeyBytes = Buffer.from(privateKeyHex, 'hex')
  const sig = await ed.signAsync(message, privateKeyBytes)
  return Buffer.from(sig).toString('base64url')
}

export async function verify(
  message: Uint8Array,
  signatureBase64url: string,
  publicKeyHex: string,
): Promise<boolean> {
  try {
    const sig = Buffer.from(signatureBase64url, 'base64url')
    const pub = Buffer.from(publicKeyHex, 'hex')
    return await ed.verifyAsync(sig, message, pub)
  } catch {
    return false
  }
}

/** Encode public key as multibase base58btc (W3C Ed25519VerificationKey2020) */
export function encodePublicKey(publicKeyHex: string): string {
  const bytes = Buffer.from(publicKeyHex, 'hex')
  return 'z' + bs58.encode(bytes)
}

export function decodePublicKey(multibase: string): string {
  const bytes = bs58.decode(multibase.slice(1))
  return Buffer.from(bytes).toString('hex')
}
