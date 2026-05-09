/**
 * Unit tests for the chain BBS+ client. The RpcClient is mocked so these
 * run without a live testnet — wire-format expectations are enforced.
 *
 * Cross-language interop tests against a live testnet live separately
 * (`scripts/seed-testnet.mjs`-style) and are not part of the unit suite.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createChainBbs, utf8ToHex } from '../chain/bbs.js'
import { RpcClient } from '../chain/rpc.js'
import type { ChainConfig } from '../chain/index.js'

interface RpcCall {
  method: string
  params: unknown[]
}

/**
 * Build a fake RpcClient that records every call and replays canned responses.
 */
function mockRpc(responses: Record<string, unknown | ((params: unknown[]) => unknown)>) {
  const calls: RpcCall[] = []
  const client = new RpcClient('http://mock')
  client.call = async <T>(method: string, params: unknown[]): Promise<T> => {
    calls.push({ method, params })
    const r = responses[method]
    if (r === undefined) throw new Error(`mock: no response set for ${method}`)
    if (typeof r === 'function') return (r as (p: unknown[]) => unknown)(params) as T
    return r as T
  }
  return { client, calls }
}

const config: ChainConfig = {
  rpcUrl: 'http://mock',
  // Deterministic key so getAddressFromKey is reproducible.
  signerPrivateKey: '0011223344556677889900112233445566778899001122334455667788990011',
  network: 'testnet',
}

const ZERO_HASH = new Uint8Array(32)
// 96-byte buffer that's NOT a valid pubkey on the chain — chain-side validation
// will reject this. The TS layer only checks length, so issueCredential is happy
// to forward it.
function dummyPubkey(): Uint8Array {
  const a = new Uint8Array(96)
  a.fill(0xab)
  return a
}

describe('chain bbs.verifyProof', () => {
  it('forwards the expected JSON-RPC params', async () => {
    const { client, calls } = mockRpc({ solidus_bbsVerifyProof: true })
    const bbs = createChainBbs(client, config)

    const result = await bbs.verifyProof({
      proofHex: 'deadbeef',
      pubkeyHex: 'a'.repeat(192),
      headerHex: utf8ToHex('hdr'),
      phHex: utf8ToHex('ph'),
      disclosedMessages: [
        { index: 0, message: utf8ToHex('did:solidus:testnet:alice') },
        { index: 3, message: utf8ToHex('GB') },
      ],
      totalMessageCount: 8,
    })

    expect(result).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0]!.method).toBe('solidus_bbsVerifyProof')
    const params = calls[0]!.params
    expect(params[0]).toBe('deadbeef')
    expect(params[1]).toBe('a'.repeat(192))
    expect(params[5]).toBe(8)
  })

  it('returns false when the chain rejects the proof', async () => {
    const { client } = mockRpc({ solidus_bbsVerifyProof: false })
    const bbs = createChainBbs(client, config)
    const result = await bbs.verifyProof({
      proofHex: '00'.repeat(240),
      pubkeyHex: '00'.repeat(96),
      disclosedMessages: [],
      totalMessageCount: 5,
    })
    expect(result).toBe(false)
  })

  it('rejects out-of-range disclosed indices client-side', async () => {
    const { client, calls } = mockRpc({ solidus_bbsVerifyProof: true })
    const bbs = createChainBbs(client, config)

    await expect(
      bbs.verifyProof({
        proofHex: '00',
        pubkeyHex: '00'.repeat(96),
        disclosedMessages: [{ index: 5, message: utf8ToHex('x') }],
        totalMessageCount: 5,
      }),
    ).rejects.toThrow(/disclosed index 5 >= totalMessageCount 5/)
    expect(calls).toHaveLength(0) // never reached the RPC
  })

  it('rejects duplicate disclosed indices', async () => {
    const { client } = mockRpc({ solidus_bbsVerifyProof: true })
    const bbs = createChainBbs(client, config)
    await expect(
      bbs.verifyProof({
        proofHex: '00',
        pubkeyHex: '00'.repeat(96),
        disclosedMessages: [
          { index: 1, message: '00' },
          { index: 1, message: '01' },
        ],
        totalMessageCount: 4,
      }),
    ).rejects.toThrow(/duplicate disclosed index 1/)
  })

  it('rejects malformed disclosed message hex', async () => {
    const { client } = mockRpc({ solidus_bbsVerifyProof: true })
    const bbs = createChainBbs(client, config)
    await expect(
      bbs.verifyProof({
        proofHex: '00',
        pubkeyHex: '00'.repeat(96),
        disclosedMessages: [{ index: 0, message: 'nothex!' }],
        totalMessageCount: 4,
      }),
    ).rejects.toThrow(/not valid hex/)
  })
})

describe('chain bbs.verifyCredentialProof', () => {
  it('decodes the chain response into BbsCredentialProofResult', async () => {
    const chainResp = {
      valid: true,
      proof_valid: true,
      is_bbs: true,
      revoked: false,
      credential: {
        id: 'urn:solidus:credential:abc',
        issuer_did: 'did:solidus:testnet:issuer',
        subject_did: 'did:solidus:testnet:alice',
        credential_type: 'KycL2',
        hash: 'a'.repeat(64),
        issued_ms: 1_700_000_000_000,
        revoked: false,
        revoked_ms: null,
        bbs_pubkey: 'b'.repeat(192),
        bbs_message_count: 8,
      },
    }
    const { client, calls } = mockRpc({ solidus_bbsVerifyCredentialProof: chainResp })
    const bbs = createChainBbs(client, config)

    const result = await bbs.verifyCredentialProof({
      credentialId: 'urn:solidus:credential:abc',
      proofHex: 'deadbeef',
      headerHex: utf8ToHex('hdr'),
      phHex: utf8ToHex('ph'),
      disclosedMessages: [{ index: 0, message: utf8ToHex('did:solidus:testnet:alice') }],
    })

    expect(result.valid).toBe(true)
    expect(result.proofValid).toBe(true)
    expect(result.isBbs).toBe(true)
    expect(result.revoked).toBe(false)
    expect(result.credential).not.toBeNull()
    expect(result.credential!.bbs_message_count).toBe(8)
    expect(calls[0]!.method).toBe('solidus_bbsVerifyCredentialProof')
    expect(calls[0]!.params[0]).toBe('urn:solidus:credential:abc')
  })

  it('handles unknown credential responses', async () => {
    const { client } = mockRpc({
      solidus_bbsVerifyCredentialProof: {
        valid: false,
        proof_valid: false,
        is_bbs: false,
        revoked: false,
        credential: null,
      },
    })
    const bbs = createChainBbs(client, config)
    const result = await bbs.verifyCredentialProof({
      credentialId: 'urn:solidus:credential:does-not-exist',
      proofHex: '00'.repeat(240),
      disclosedMessages: [],
    })
    expect(result.valid).toBe(false)
    expect(result.isBbs).toBe(false)
    expect(result.credential).toBeNull()
  })

  it('preserves proof_valid=true && valid=false for revoked credentials', async () => {
    const { client } = mockRpc({
      solidus_bbsVerifyCredentialProof: {
        valid: false,
        proof_valid: true,
        is_bbs: true,
        revoked: true,
        credential: {
          id: 'urn:solidus:credential:revoked',
          issuer_did: 'did:solidus:testnet:issuer',
          subject_did: 'did:solidus:testnet:alice',
          credential_type: 'KycL1',
          hash: '00'.repeat(32),
          issued_ms: 1_000,
          revoked: true,
          revoked_ms: 2_000,
          bbs_pubkey: 'c'.repeat(192),
          bbs_message_count: 5,
        },
      },
    })
    const bbs = createChainBbs(client, config)
    const result = await bbs.verifyCredentialProof({
      credentialId: 'urn:solidus:credential:revoked',
      proofHex: '00'.repeat(240),
      disclosedMessages: [],
    })
    expect(result.proofValid).toBe(true)
    expect(result.valid).toBe(false)
    expect(result.revoked).toBe(true)
  })
})

describe('chain bbs.issueCredential', () => {
  it('rejects bad input shapes before reaching the RPC', async () => {
    const { client, calls } = mockRpc({ solidus_getNonce: 0 })
    const bbs = createChainBbs(client, config)

    await expect(
      bbs.issueCredential({
        issuerPrivateKey: config.signerPrivateKey,
        subjectDid: 'did:solidus:testnet:alice',
        credentialType: 'Email',
        payloadHash: new Uint8Array(31), // wrong length
        bbsPubkey: dummyPubkey(),
        bbsMessageCount: 5,
      }),
    ).rejects.toThrow(/payloadHash must be 32 bytes/)

    await expect(
      bbs.issueCredential({
        issuerPrivateKey: config.signerPrivateKey,
        subjectDid: 'did:solidus:testnet:alice',
        credentialType: 'Email',
        payloadHash: ZERO_HASH,
        bbsPubkey: new Uint8Array(95), // wrong length
        bbsMessageCount: 5,
      }),
    ).rejects.toThrow(/bbsPubkey must be 96 bytes/)

    await expect(
      bbs.issueCredential({
        issuerPrivateKey: config.signerPrivateKey,
        subjectDid: 'did:solidus:testnet:alice',
        credentialType: 'Email',
        payloadHash: ZERO_HASH,
        bbsPubkey: dummyPubkey(),
        bbsMessageCount: 0,
      }),
    ).rejects.toThrow(/bbsMessageCount must be an integer in \[1, 64\]/)

    await expect(
      bbs.issueCredential({
        issuerPrivateKey: config.signerPrivateKey,
        subjectDid: 'did:solidus:testnet:alice',
        credentialType: 'Email',
        payloadHash: ZERO_HASH,
        bbsPubkey: dummyPubkey(),
        bbsMessageCount: 65,
      }),
    ).rejects.toThrow(/bbsMessageCount must be an integer in \[1, 64\]/)

    expect(calls).toHaveLength(0)
  })

  it('builds the CredentialIssueBbs payload with snake_case keys', async () => {
    const txHash = 'abcd'.repeat(16)
    const { client, calls } = mockRpc({
      solidus_getNonce: 0,
      solidus_sendTransaction: txHash,
      solidus_getReceipt: {
        tx_hash: txHash,
        status: 'success',
        block_height: 1,
        fee_paid: 625_000_000,
        events: [
          {
            type: 'CredentialIssued',
            credentialId: 'urn:solidus:credential:bbs-test',
          },
        ],
      },
    })
    const bbs = createChainBbs(client, config)

    const result = await bbs.issueCredential({
      issuerPrivateKey: config.signerPrivateKey,
      subjectDid: 'did:solidus:testnet:alice',
      credentialType: 'KycL2',
      payloadHash: ZERO_HASH,
      bbsPubkey: dummyPubkey(),
      bbsMessageCount: 8,
    })

    expect(result.txHash).toBe(txHash)
    expect(result.credentialId).toBe('urn:solidus:credential:bbs-test')

    // Find the sendTransaction call and inspect the payload.
    const sendCall = calls.find((c) => c.method === 'solidus_sendTransaction')
    expect(sendCall).toBeDefined()
    const tx = JSON.parse(sendCall!.params[0] as string) as {
      payload: { CredentialIssueBbs?: Record<string, unknown> }
    }
    const payload = tx.payload.CredentialIssueBbs
    expect(payload).toBeDefined()
    expect(payload!['subject_did']).toBe('did:solidus:testnet:alice')
    expect(payload!['credential_type']).toBe('KycL2')
    expect(Array.isArray(payload!['hash'])).toBe(true)
    expect((payload!['hash'] as number[]).length).toBe(32)
    expect(Array.isArray(payload!['bbs_pubkey'])).toBe(true)
    expect((payload!['bbs_pubkey'] as number[]).length).toBe(96)
    expect(payload!['bbs_message_count']).toBe(8)
  })
})
