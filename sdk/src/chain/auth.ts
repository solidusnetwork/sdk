/**
 * Chain-backed auth methods.
 *
 * Presentation verification resolves the holder's DID document from the chain
 * to obtain the Ed25519 public key, then delegates to @solidus/auth for
 * cryptographic verification (challenge expiry, holder match, nonce match,
 * EdDSA signature).
 */
import { randomUUID } from 'node:crypto'
import type { AuthResult } from '@solidus/types'
import type { DIDDocument, VerificationMethod } from '@solidus/types'
import type { RpcClient } from './rpc.js'
import type { ChainConfig } from './index.js'
import {
  verifyPresentation as verifyVP,
  type VerifiablePresentation,
  type Challenge,
} from '@solidus/auth'
import bs58 from 'bs58'

interface ChallengeStore {
  [id: string]: Challenge
}

export function createChainAuth(rpc: RpcClient, _config: ChainConfig) {
  const challenges: ChallengeStore = {}

  return {
    async createChallenge(domain: string, did?: string): Promise<string> {
      const id = randomUUID()
      const now = new Date()
      const challenge: Challenge = {
        id,
        did: did ?? '',
        nonce: id,
        issuedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 300_000).toISOString(),
      }
      challenges[id] = challenge
      return id
    },

    async verifyPresentation(
      vpJson: string,
      challengeId: string,
      _domain: string,
    ): Promise<AuthResult> {
      const challenge = challenges[challengeId]
      if (!challenge) {
        return { valid: false, claims: {} }
      }

      let vp: VerifiablePresentation
      try {
        vp = JSON.parse(vpJson) as VerifiablePresentation
      } catch {
        return { valid: false, claims: {} }
      }

      const holderDid = vp.holder
      if (!holderDid) {
        return { valid: false, claims: {} }
      }

      // Update challenge DID to match the presenter (if not set at creation).
      if (!challenge.did) {
        challenge.did = holderDid
      }

      // Resolve DID document from chain.
      const didDoc = await rpc.call<DIDDocument | null>('solidus_didResolve', [holderDid])
      if (!didDoc) {
        return { valid: false, claims: {} }
      }

      const result = await verifyVP(challenge, vp, async (verificationMethodId: string) => {
        const vm = didDoc.verificationMethod?.find(
          (m: VerificationMethod) => m.id === verificationMethodId,
        )
        if (!vm) {
          throw new Error(`Verification method ${verificationMethodId} not found in DID document`)
        }
        // publicKeyMultibase: 'z' prefix + base58btc-encoded Ed25519 public key
        const multibase = vm.publicKeyMultibase
        if (!multibase.startsWith('z')) {
          throw new Error(`Unsupported multibase prefix: ${multibase[0]}`)
        }
        return bs58.decode(multibase.slice(1))
      })

      // Clean up used challenge.
      delete challenges[challengeId]

      if (!result.valid) {
        return { valid: false, claims: {} }
      }

      return {
        valid: true,
        did: holderDid,
        claims: {},
      }
    },
  }
}
