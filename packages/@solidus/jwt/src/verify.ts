import * as ed from '@noble/ed25519'
import { JWTExpiredError, JWTInvalidError } from './types.js'
import type { JWTPayload, VerifyOptions } from './types.js'

function base64urlDecode(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=')
  return new Uint8Array(Buffer.from(padded, 'base64'))
}

/**
 * Verify an EdDSA JWT and return its payload.
 *
 * @param token - The JWT string
 * @param publicKey - 32-byte Ed25519 public key (raw bytes)
 * @param options - Optional: issuer, audience validation
 * @throws JWTExpiredError if `exp` claim is in the past
 * @throws JWTInvalidError if signature is invalid, token is malformed, or iss/aud mismatch
 */
export async function verify(
  token: string,
  publicKey: Uint8Array,
  options?: VerifyOptions,
): Promise<JWTPayload> {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new JWTInvalidError('Malformed token: expected 3 dot-separated parts')
  }

  const [header, body, sig] = parts as [string, string, string]
  const signingInput = `${header}.${body}`

  // 1. Verify signature
  let signature: Uint8Array
  try {
    signature = base64urlDecode(sig)
  } catch {
    throw new JWTInvalidError('Invalid signature encoding')
  }

  let valid: boolean
  try {
    valid = await ed.verifyAsync(
      signature,
      new TextEncoder().encode(signingInput),
      publicKey,
    )
  } catch {
    throw new JWTInvalidError('Signature verification failed')
  }
  if (!valid) throw new JWTInvalidError('Invalid signature')

  // 2. Parse payload
  let payload: JWTPayload
  try {
    payload = JSON.parse(
      Buffer.from(base64urlDecode(body)).toString('utf8'),
    ) as JWTPayload
  } catch {
    throw new JWTInvalidError('Invalid payload: not valid JSON')
  }

  // 3. Check expiry
  if (payload.exp !== undefined && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new JWTExpiredError()
  }

  // 4. Check issuer
  if (options?.issuer !== undefined && payload.iss !== options.issuer) {
    throw new JWTInvalidError(
      `Issuer mismatch: expected "${options.issuer}", got "${payload.iss}"`,
    )
  }

  // 5. Check audience
  if (options?.audience !== undefined && payload.aud !== options.audience) {
    throw new JWTInvalidError(
      `Audience mismatch: expected "${options.audience}", got "${payload.aud}"`,
    )
  }

  return payload
}
