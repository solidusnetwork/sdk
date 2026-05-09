# Solidus SDK

[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](https://github.com/solidusnetwork/sdk/blob/main/LICENSE)

TypeScript packages for building on the [Solidus Network](https://solidus.network) — a blockchain protocol for decentralized identity and verifiable credentials.

## Published packages

The three production packages are published to npm under the `@solidus-network` scope:

| Package | npm | Description |
|---------|-----|-------------|
| [`@solidus-network/sdk`](https://www.npmjs.com/package/@solidus-network/sdk) | [![npm](https://img.shields.io/npm/v/@solidus-network/sdk?label=&color=cb3837)](https://www.npmjs.com/package/@solidus-network/sdk) | Main SDK — DID resolution, credential issuance/verification, on-chain queries |
| [`@solidus-network/auth`](https://www.npmjs.com/package/@solidus-network/auth) | [![npm](https://img.shields.io/npm/v/@solidus-network/auth?label=&color=cb3837)](https://www.npmjs.com/package/@solidus-network/auth) | DID-based authentication primitives — Ed25519 challenge / W3C VP verification |
| [`@solidus-network/types`](https://www.npmjs.com/package/@solidus-network/types) | [![npm](https://img.shields.io/npm/v/@solidus-network/types?label=&color=cb3837)](https://www.npmjs.com/package/@solidus-network/types) | Shared TypeScript types — DIDs, Verifiable Credentials, auth challenges |
| [`@solidus-network/bbs`](https://www.npmjs.com/package/@solidus-network/bbs) | [![npm](https://img.shields.io/npm/v/@solidus-network/bbs?label=&color=cb3837)](https://www.npmjs.com/package/@solidus-network/bbs) | BBS+ selective-disclosure primitives — IRTF draft-irtf-cfrg-bbs-signatures, BLS12-381 SHA-256, byte-compatible with the Solidus chain |

## Install

```bash
npm install @solidus-network/sdk @solidus-network/auth @solidus-network/types
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

// Resolve a DID
const doc = await solidus.did.resolve('did:solidus:testnet:abc123')

// Issue a credential (as an authorized issuer)
const vc = await solidus.credentials.issue({
  subject: 'did:solidus:testnet:xyz789',
  type: ['VerifiableCredential', 'KYCVerified'],
  claims: { country: 'US', tier: 'standard' },
})

// Verify
const result = await solidus.credentials.verify(vc.id)
```

DID-based authentication, in three lines of server code:

```ts
import { createChallenge, verifyPresentation } from '@solidus-network/auth'

const challenge = createChallenge('did:solidus:testnet:abc123', 300)
// Client signs the challenge nonce and returns a Verifiable Presentation
const result = await verifyPresentation({ presentation, challenge, getPublicKey })
```

## Modes

- **`stub`** — local Postgres-backed mock for development; no chain interaction.
- **`testnet`** — talks to the Solidus testnet via JSON-RPC at `rpc.solidus.network`.
- **`mainnet`** — reserved for the upcoming mainnet launch.

## Other workspace packages

Packages in this repo that are not yet published — kept here as the canonical source for the next release wave:

| Package | Status | Description |
|---------|--------|-------------|
| `@solidus/jwt` | Internal | JWT utilities — sign/verify/decode with Ed25519 keys |
| `@solidus/events` | Internal | RabbitMQ event bus client |
| `@solidus/config` | Internal | Shared TypeScript / ESLint / Vitest config |
| `@solidus/ui` | Stub | Shared React component primitives (planned) |

## Documentation

- **SDK docs:** https://docs.solidus.network/sdk
- **Guides:** https://docs.solidus.network/guides (Express, Next.js, KYC integration, webhooks)
- **API reference:** https://docs.solidus.network/api
- **Whitepaper:** https://github.com/solidusnetwork/docs/blob/main/whitepaper.md

## Network

- **Testnet RPC:** `https://rpc.solidus.network`
- **Explorer:** https://explorer.solidus.network
- **Status:** https://solidus.network

## License

Apache-2.0 — see [LICENSE](./sdk/LICENSE) (each published package ships its own copy).
