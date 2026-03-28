import { randomBytes, randomUUID } from 'node:crypto'

export interface Challenge {
  /** UUID, for idempotency and storage */
  id: string
  /** DID this challenge was issued for */
  did: string
  /** 32-byte random hex string — the value the holder must sign */
  nonce: string
  /** ISO 8601 */
  issuedAt: string
  /** ISO 8601 */
  expiresAt: string
}

/**
 * Create a new DID auth challenge.
 *
 * @param did - The DID the challenge is issued for
 * @param ttlSeconds - How long the challenge is valid (default: 300 = 5 minutes)
 */
export function createChallenge(did: string, ttlSeconds = 300): Challenge {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1_000)
  return {
    id: randomUUID(),
    did,
    nonce: randomBytes(32).toString('hex'),
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }
}
