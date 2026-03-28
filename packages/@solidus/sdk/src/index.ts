import { randomUUID } from 'node:crypto'
import type {
  DID, DIDDocument, VerifiableCredential,
  IssueCredentialParams, VerificationResult, AuthResult,
} from '@solidus/types'
import { didCreate, didResolve, didDeactivate } from './stub/did.js'
import { credentialsIssue, credentialsVerify, credentialsRevoke, credentialsQuery } from './stub/credentials.js'
import { getSql } from './stub/db.js'

export type {
  DID, DIDDocument, VerifiableCredential,
  IssueCredentialParams, VerificationResult, AuthResult,
}
export { runMigrations, closeConnection } from './stub/db.js'
export { generateKeypair, decodePublicKey } from './stub/crypto.js'

export interface SolidusSDK {
  did: {
    create(publicKey: string): Promise<DID>
    resolve(did: string): Promise<DIDDocument | null>
    deactivate(did: string, signerKey: string): Promise<void>
  }
  credentials: {
    issue(params: IssueCredentialParams): Promise<VerifiableCredential>
    verify(vcId: string): Promise<VerificationResult>
    revoke(credentialId: string, issuerKey: string): Promise<void>
    query(subjectDid: string): Promise<VerifiableCredential[]>
  }
  auth: {
    createChallenge(domain: string): Promise<string>
    verifyPresentation(vp: string, challenge: string, domain: string): Promise<AuthResult>
  }
}

export function createSdk(_config: { mode: 'stub' | 'testnet' | 'mainnet' }): SolidusSDK {
  return {
    did: {
      create: didCreate,
      resolve: didResolve,
      deactivate: didDeactivate,
    },
    credentials: {
      issue: credentialsIssue,
      verify: credentialsVerify,
      revoke: credentialsRevoke,
      query: credentialsQuery,
    },
    auth: {
      async createChallenge(domain: string): Promise<string> {
        const sql = getSql()
        const challenge = randomUUID()
        await sql`INSERT INTO stub_challenges (challenge, domain) VALUES (${challenge}, ${domain})`
        return challenge
      },
      async verifyPresentation(
        _vp: string,
        _challenge: string,
        _domain: string,
      ): Promise<AuthResult> {
        // Real VP verification ships with Identity (Phase 2)
        return { valid: true, claims: {} }
      },
    },
  }
}
