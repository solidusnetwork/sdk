import * as ed from '@noble/ed25519'
import type { JWTPayload, SignOptions } from './types.js'

function base64url(input: Uint8Array | string): string {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : input
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/** Parse duration string ('15m', '7d', '1h', '30s') to seconds */
function parseDuration(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration)
  if (!match) throw new Error(`Invalid duration: "${duration}". Use format like '15m', '7d', '1h', '30s'`)
  const value = parseInt(match[1]!, 10)
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 }
  return value * (multipliers[match[2]!] ?? 1)
}

/**
 * Sign a JWT payload with an Ed25519 private key.
 *
 * @param payload - Claims to include. If `exp` is already set, `expiresIn` is ignored.
 * @param privateKey - 32-byte Ed25519 private key (raw bytes)
 * @param options - Optional: expiresIn, issuer, audience
 * @throws Error if privateKey is not exactly 32 bytes
 */
export async function sign(
  payload: JWTPayload,
  privateKey: Uint8Array,
  options?: SignOptions,
): Promise<string> {
  if (privateKey.length !== 32) {
    throw new Error(`privateKey must be 32 bytes, got ${privateKey.length}`)
  }

  const header = base64url(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' }))

  const now = Math.floor(Date.now() / 1000)
  const claims: Record<string, unknown> = { ...payload, iat: now }

  if (payload.exp === undefined && options?.expiresIn) {
    claims['exp'] = now + parseDuration(options.expiresIn)
  }
  if (options?.issuer !== undefined) claims['iss'] = options.issuer
  if (options?.audience !== undefined) claims['aud'] = options.audience

  const body = base64url(JSON.stringify(claims))
  const signingInput = `${header}.${body}`

  const signature = await ed.signAsync(
    new TextEncoder().encode(signingInput),
    privateKey,
  )

  return `${signingInput}.${base64url(signature)}`
}
