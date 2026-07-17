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

const solidus = createSdk({
  mode: 'testnet',
  chain: {
    rpcUrl: 'https://rpc.solidus.network',
    network: 'testnet',
    signerPrivateKey: process.env.SOLIDUS_SIGNER_KEY!,
  },
})

// Resolve a DID — returns the W3C resolution metadata shape
const { didDocument, didDocumentMetadata } =
  await solidus.did.resolveWithMetadata('did:solidus:testnet:abc123')

// Issue a W3C VC 2.0 credential (as an authorised issuer)
const vc = await solidus.credentials.issue({
  subject: 'did:solidus:testnet:xyz789',
  type: ['VerifiableCredential', 'KYCVerified'],
  claims: { country: 'US', tier: 'standard' },
  validFrom: new Date().toISOString(),
})
```

### SD-JWT VC (EUDI Wallet-aligned)

```ts
import { issueSdJwtVc, verifySdJwtVc, presentSdJwtVc } from '@solidus-network/sdk'

const sdJwt = await issueSdJwtVc({
  issuerPrivateKey,
  issuerDid: 'did:solidus:testnet:issuer1',
  vct: 'https://example.com/credentials/age',
  claims: { given_name: 'Ada', birth_date: '1990-01-01' },
  disclosable: ['birth_date'],
  holderJwk,
})

// Holder presents only the necessary claim, key-binding included
const presentation = await presentSdJwtVc({
  sdJwt, claimsToReveal: ['birth_date'],
  audience: 'https://verifier.example', nonce: 'abc',
  holderPrivateKey,
})

const result = await verifySdJwtVc({
  sdJwt: presentation,
  expectedAudience: 'https://verifier.example',
  expectedNonce: 'abc',
  issuerResolver: createChainBackedIssuerResolverFromRpc(),
})
```

### BBS+ selective disclosure

```ts
import { signBbs, deriveProofBbs, verifyProofBbs } from '@solidus-network/bbs'

const signed = await signBbs({
  issuerSecretKey,
  messages: ['name=Ada', 'over18=true', 'birth_date=1990-01-01'],
})

// Holder discloses only "over18=true" — birth_date stays hidden
const proof = await deriveProofBbs({
  signature: signed,
  messages: signed.messages,
  reveal: [1], // index of "over18=true"
  nonce: 'verifier-nonce',
})

const ok = await verifyProofBbs({
  proof,
  revealedMessages: { 1: 'over18=true' },
  issuerPublicKey,
})
```

### DID-based authentication

```ts
import { createChallenge, verifyPresentation } from '@solidus-network/auth'

const challenge = createChallenge('did:solidus:testnet:abc123', 300)
// Client signs the challenge nonce and returns a Verifiable Presentation
const result = await verifyPresentation({ presentation, challenge, getPublicKey })
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
