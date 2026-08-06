<p align="center">
  <img src="https://raw.githubusercontent.com/solidusnetwork/.github/main/profile/solidus_icon.png" alt="Solidus Network" height="80" />
</p>

# Solidus SDK

[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](https://github.com/solidusnetwork/sdk/blob/main/LICENSE)

TypeScript packages for building on the [Solidus Network](https://solidus.network) — a
blockchain protocol for decentralized identity and verifiable credentials.

## Published packages

Published to npm under the `@solidus-network` scope. **Versions in the badges are live from the registry** — this page does not restate them, because a number typed into prose goes stale the day after you type it.

### Core

| Package | npm | Description |
|---------|-----|-------------|
| [`@solidus-network/sdk`](https://www.npmjs.com/package/@solidus-network/sdk) | [![npm](https://img.shields.io/npm/v/@solidus-network/sdk?label=&color=cb3837)](https://www.npmjs.com/package/@solidus-network/sdk) | Main SDK — DID resolution + rotation, credential issuance/verification, SD-JWT VC (incl. KB-JWT, status list, nested-path disclosure), on-chain queries |
| [`@solidus-network/auth`](https://www.npmjs.com/package/@solidus-network/auth) | [![npm](https://img.shields.io/npm/v/@solidus-network/auth?label=&color=cb3837)](https://www.npmjs.com/package/@solidus-network/auth) | DID-based authentication primitives — Ed25519 challenge, W3C VP verification |
| [`@solidus-network/types`](https://www.npmjs.com/package/@solidus-network/types) | [![npm](https://img.shields.io/npm/v/@solidus-network/types?label=&color=cb3837)](https://www.npmjs.com/package/@solidus-network/types) | Shared TypeScript types — DIDs, Verifiable Credentials (Data Model 2.0), auth challenges |
| [`@solidus-network/bbs`](https://www.npmjs.com/package/@solidus-network/bbs) | [![npm](https://img.shields.io/npm/v/@solidus-network/bbs?label=&color=cb3837)](https://www.npmjs.com/package/@solidus-network/bbs) | BBS+ selective-disclosure primitives — `draft-irtf-cfrg-bbs-signatures`, BLS12-381 SHA-256, byte-compatible with the on-chain implementation |

### Agent identity

Portable identity for AI agents. Built on the core above; you do not need these to issue
or verify human credentials. Source lives in the [Solidus monorepo](https://github.com/solidusnetwork), not this repo.

| Package | npm | Description |
|---------|-----|-------------|
| [`@solidus-network/agent-identity`](https://www.npmjs.com/package/@solidus-network/agent-identity) | [![npm](https://img.shields.io/npm/v/@solidus-network/agent-identity?label=&color=cb3837)](https://www.npmjs.com/package/@solidus-network/agent-identity) | did:solidus DIDs, BBS+ selective-disclosure credentials, and ERC-8004 passport anchoring for AI agents |
| [`@solidus-network/agent-identity-verify`](https://www.npmjs.com/package/@solidus-network/agent-identity-verify) | [![npm](https://img.shields.io/npm/v/@solidus-network/agent-identity-verify?label=&color=cb3837)](https://www.npmjs.com/package/@solidus-network/agent-identity-verify) | Hot-path verifier — offline BBS+ proof verification plus a cached, fail-closed OAuth Status List revocation check |
| [`@solidus-network/agent-identity-react`](https://www.npmjs.com/package/@solidus-network/agent-identity-react) | [![npm](https://img.shields.io/npm/v/@solidus-network/agent-identity-react?label=&color=cb3837)](https://www.npmjs.com/package/@solidus-network/agent-identity-react) | React components — the Verified-by-Solidus badge, agent passport card, mandate-approval prompt |

### ID capture

Browser-side document capture, used by [Solidus Verify](https://verify.solidus.network).
Source lives in the monorepo, not this repo.

| Package | npm | Description |
|---------|-----|-------------|
| [`@solidus-network/capture`](https://www.npmjs.com/package/@solidus-network/capture) | [![npm](https://img.shields.io/npm/v/@solidus-network/capture?label=&color=cb3837)](https://www.npmjs.com/package/@solidus-network/capture) | Embeddable web ID-capture SDK — guided camera capture with quality gating and on-device MRZ/barcode extraction |
| [`@solidus-network/id-extract`](https://www.npmjs.com/package/@solidus-network/id-extract) | [![npm](https://img.shields.io/npm/v/@solidus-network/id-extract?label=&color=cb3837)](https://www.npmjs.com/package/@solidus-network/id-extract) | Client-side (WASM) extraction — barcode read, MRZ OCR, checksum reconstruction, confidence gate. Framework-free |


### Wallet, agent runtime and tooling

Source lives in the monorepo, not this repo.

| Package | npm | Description |
|---------|-----|-------------|
| [`@solidus-network/wallet`](https://www.npmjs.com/package/@solidus-network/wallet) | [![npm](https://img.shields.io/npm/v/@solidus-network/wallet?label=&color=cb3837)](https://www.npmjs.com/package/@solidus-network/wallet) | Wallet SDK — did:solidus keypair derivation, injectable credential store, BBS+ selective-disclosure presentation, scoped payment-mandate stamping |
| [`@solidus-network/mcp`](https://www.npmjs.com/package/@solidus-network/mcp) | [![npm](https://img.shields.io/npm/v/@solidus-network/mcp?label=&color=cb3837)](https://www.npmjs.com/package/@solidus-network/mcp) | MCP server — run-time agent tools: resolve did:solidus, verify credentials, check/create scoped spend mandates, authorize payments against them |
| [`@solidus-network/auth-otp`](https://www.npmjs.com/package/@solidus-network/auth-otp) | [![npm](https://img.shields.io/npm/v/@solidus-network/auth-otp?label=&color=cb3837)](https://www.npmjs.com/package/@solidus-network/auth-otp) | Provider-agnostic OTP (SMS/email) login core — injected clock, rng, store, sender and identity resolver; the caller owns session issuance and delivery |
| [`@solidus-network/cli`](https://www.npmjs.com/package/@solidus-network/cli) | [![npm](https://img.shields.io/npm/v/@solidus-network/cli?label=&color=cb3837)](https://www.npmjs.com/package/@solidus-network/cli) | CLI — wire did:solidus, verify and agent identity into your app in one command |

## Install

```bash
npm install \
  @solidus-network/sdk \
  @solidus-network/auth \
  @solidus-network/types \
  @solidus-network/bbs
```

## Quick start

```ts
import { createSdk } from '@solidus-network/sdk'

// Config is flat — there is no `chain` wrapper.
const solidus = createSdk({
  mode: 'testnet',
  rpcUrl: 'https://rpc.solidus.network',
  signerPrivateKey: process.env.SOLIDUS_SIGNER_KEY,
})

// Resolve a DID. Returns null when the DID is unknown or deactivated.
const didDocument = await solidus.did.resolve('did:solidus:testnet:abc123')

// Spec-conformant W3C DID Resolution — distinguishes "not found" from
// "deactivated" instead of folding both into null. Chain mode only, so it is
// optional on the SDK surface and `undefined` in stub mode. Guard it.
if (solidus.did.resolveWithMetadata) {
  const { didDocument, didDocumentMetadata } =
    await solidus.did.resolveWithMetadata('did:solidus:testnet:abc123')
}

// Issue a W3C VC 2.0 credential (as an authorised issuer)
const vc = await solidus.credentials.issue({
  subjectDid: 'did:solidus:testnet:xyz789',
  issuerDid: 'did:solidus:testnet:issuer1',
  issuerPrivateKey: process.env.SOLIDUS_ISSUER_KEY!,
  type: ['VerifiableCredential', 'KYCVerified'],
  claims: { country: 'US', tier: 'standard' },
  expiresInDays: 365,
})
```

### SD-JWT VC (EUDI Wallet-aligned)

```ts
import { issueSdJwtVc, presentSdJwtVc, verifySdJwtVc } from '@solidus-network/sdk'

// Ed25519 keys are raw bytes — Uint8Array, not hex strings and not JWKs.
declare const issuerPrivateKey: Uint8Array, issuerPublicKey: Uint8Array
declare const holderPrivateKey: Uint8Array, holderPublicKey: Uint8Array

// Anything NOT listed in `disclosable` is always visible to the verifier, so
// list every claim the holder should be able to withhold.
const issued = await issueSdJwtVc({
  issuer: 'did:solidus:testnet:issuer1',
  vct: 'https://example.com/credentials/age',
  subject: { given_name: 'Ada', birth_date: '1990-01-01' },
  disclosable: ['given_name', 'birth_date'],
  issuerPrivateKey,
  holderPublicKey, // binds the credential to this holder, enabling the KB-JWT
})

// Holder reveals birth_date and withholds given_name. The Key-Binding JWT ties
// that disclosure to one verifier and one nonce, so it cannot be replayed.
const presentation = await presentSdJwtVc({
  compact: issued.compact,
  claimsToReveal: ['birth_date'],
  audience: 'https://verifier.example',
  nonce: 'abc',
  holderPrivateKey,
})

// The verifier supplies the issuer's public key itself — resolve it from the
// issuer DID (`solidus.did.resolve`) and apply your own trust policy.
const result = await verifySdJwtVc({
  compact: presentation.compact,
  issuerPublicKey,
  expectedAudience: 'https://verifier.example',
  expectedNonce: 'abc',
})
```

### BBS+ selective disclosure

The API is class-based. Messages and headers are raw bytes; `utf8()` encodes them.

```ts
import { BbsSecretKey, utf8 } from '@solidus-network/bbs'

const messages = ['name=Ada', 'over18=true', 'birth_date=1990-01-01'].map(utf8)
const header = utf8('solidus-kyc-v1')

// Issuer signs the whole message set once
const sk = await BbsSecretKey.generate()
const pk = await sk.publicKey()
const signature = await sk.sign(header, messages)

// Holder discloses only "over18=true" (index 1) — the rest stay hidden.
// The presentation header binds the proof to one verifier challenge.
const presentationHeader = utf8('verifier-nonce')
const proof = await signature.createProof({
  pk,
  header,
  presentationHeader,
  messages,
  disclosedIndices: [1],
})

// The verifier never sees name or birth_date — only what was disclosed
const ok = await proof.verify({
  pk,
  header,
  presentationHeader,
  disclosedIndices: [1],
  disclosedMessages: [messages[1]],
})
```

### DID-based authentication

```ts
import { createChallenge, verifyPresentation } from '@solidus-network/auth'
import type { VerifiablePresentation } from '@solidus-network/auth'

// Holder DID, then a time-to-live in seconds
const challenge = createChallenge('did:solidus:testnet:abc123', 300)

// The client signs challenge.nonce and returns a W3C Verifiable Presentation
declare const presentation: VerifiablePresentation

// Resolve the holder's Ed25519 public key from the VP's verificationMethod id
declare const getPublicKey: (verificationMethodId: string) => Promise<Uint8Array>

// Three positional arguments, in this order — not one options object
const result = await verifyPresentation(challenge, presentation, getPublicKey)
```

## Modes

- **`stub`** — local Postgres-backed mock for development; no chain interaction.
- **`testnet`** — talks to the Solidus testnet via JSON-RPC at `rpc.solidus.network`.
- **`mainnet`** — reserved for the post-audit launch.

## Documentation

- **SDK docs:** <https://docs.solidus.network/sdk>
- **Guides:** <https://docs.solidus.network/guides> (Express, Next.js, KYC integration, webhooks)
- **API reference:** <https://docs.solidus.network/api>
- **Whitepaper:** <https://docs.solidus.network/resources/whitepaper>
- **`did:solidus` method spec:** <https://github.com/solidusnetwork/did-solidus-spec/blob/v0.1.0/SPEC.md>

## Network

- **Testnet RPC:** <https://rpc.solidus.network>
- **Explorer:** <https://explorer.solidus.network>
- **Status:** <https://solidus.network>

## License

Apache-2.0 — see [LICENSE](./sdk/LICENSE) (each published package ships its own copy).
