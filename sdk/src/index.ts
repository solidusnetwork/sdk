import { randomUUID } from 'node:crypto'
import type {
  DID, DIDDocument, VerifiableCredential,
  IssueCredentialParams, VerificationResult, AuthResult,
} from '@solidus/types'
import { didCreate, didResolve, didDeactivate } from './stub/did.js'
import { credentialsIssue, credentialsVerify, credentialsRevoke, credentialsQuery } from './stub/credentials.js'
import { getSql } from './stub/db.js'
import { createChainClient, type ChainConfig } from './chain/index.js'

export type {
  DID, DIDDocument, VerifiableCredential,
  IssueCredentialParams, VerificationResult, AuthResult,
}
export { runMigrations, closeConnection } from './stub/db.js'
export { generateKeypair, decodePublicKey } from './stub/crypto.js'
export type { ChainConfig } from './chain/index.js'

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

export interface SolidusConfig {
  mode: 'stub' | 'testnet' | 'mainnet'
  /** JSON-RPC URL for testnet/mainnet modes (default: http://127.0.0.1:9944) */
  rpcUrl?: string
  /** Hex-encoded Ed25519 private key for testnet/mainnet modes */
  signerPrivateKey?: string
}

function createStubSdk(): SolidusSDK {
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

export function createSdk(config: SolidusConfig): SolidusSDK {
  const mode = config.mode ?? ((process.env['SOLIDUS_SDK_MODE'] as 'stub' | 'testnet' | 'mainnet' | undefined) ?? 'stub')

  switch (mode) {
    case 'testnet':
    case 'mainnet': {
      const rpcUrl = config.rpcUrl ?? process.env['SOLIDUS_RPC_URL'] ?? 'http://127.0.0.1:9944'
      const signerKey = config.signerPrivateKey ?? process.env['SOLIDUS_SIGNER_KEY'] ?? ''
      if (!signerKey) {
        throw new Error('signerPrivateKey or SOLIDUS_SIGNER_KEY env var required for chain mode')
      }
      return createChainClient({ rpcUrl, signerPrivateKey: signerKey, network: mode })
    }
    case 'stub':
    default:
      return createStubSdk()
  }
}
