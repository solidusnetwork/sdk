/**
 * Chain-backed auth methods.
 *
 * Authentication challenges are ephemeral (client-side random UUIDs) and
 * do not require chain transactions. Presentation verification resolves
 * the holder's DID document from the chain to check the signature.
 *
 * For MVP, verifyPresentation returns a stub success result. Full VP
 * verification ships with Identity Phase 2.
 */
import { randomUUID } from 'node:crypto'
import type { AuthResult } from '@solidus/types'
import type { RpcClient } from './rpc.js'
import type { ChainConfig } from './index.js'

export function createChainAuth(_rpc: RpcClient, _config: ChainConfig) {
  return {
    async createChallenge(_domain: string): Promise<string> {
      // Challenges are ephemeral — no chain interaction needed.
      return randomUUID()
    },

    async verifyPresentation(
      _vp: string,
      _challenge: string,
      _domain: string,
    ): Promise<AuthResult> {
      // Full VP verification (parse VP, resolve holder DID from chain,
      // verify Ed25519 signature) ships with Identity Phase 2.
      // For now, return a stub success.
      return { valid: true, claims: {} }
    },
  }
}
