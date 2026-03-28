<p align="center">
  <img src="brand/logos/solidus_icon.png" alt="Solidus SDK" height="80" />
</p>

<h3 align="center">Solidus SDK</h3>

<p align="center">
  TypeScript packages for building with the Solidus Network.<br/>
  <strong>DIDs, Verifiable Credentials, and authentication — in a few lines of code.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/language-TypeScript-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/runtime-Node.js_20+-green?style=flat-square" />
  <img src="https://img.shields.io/badge/license-proprietary-lightgrey?style=flat-square" />
</p>

---

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| `@solidus/types` | Shared TypeScript types (DID, VC, Auth) | Published |
| `@solidus/sdk` | Core SDK client — DID, credentials, auth | Published |
| `@solidus/auth` | "Sign in with Solidus" — DID challenge/verify | Published |
| `@solidus/jwt` | EdDSA JWT creation and verification | Published |
| `@solidus/events` | RabbitMQ event bus for inter-service messaging | Published |
| `@solidus/config` | Shared tsconfig, ESLint, Tailwind config | Published |

## Quick Start

```typescript
import { createSdk } from '@solidus/sdk'

const solidus = createSdk({ mode: 'stub' })

// Create a DID
const { did, document } = await solidus.did.create({
  publicKey: keypair.publicKey
})
// → did:solidus:stub:5dK3fP7vLm8Qw2xNz9Rb4YcJ6tHgAs

// Issue a credential
const vc = await solidus.credentials.issue({
  issuerDid: issuer.did,
  subjectDid: did,
  type: 'KycL1',
  hash: documentHash
})

// Verify a credential
const result = await solidus.credentials.verify(vc.credentialId)
// → { valid: true, revoked: false }
```

## Authentication

```typescript
import { SolidusAuth } from '@solidus/auth'

// Server-side: create challenge
const challenge = await solidus.auth.createChallenge({
  did: userDid
})

// Client-side: sign challenge
const signature = await sign(challenge, privateKey)

// Server-side: verify
const session = await solidus.auth.verifyPresentation({
  challenge, signature, did: userDid
})
```

## Architecture

The SDK supports transparent backend switching via a single environment variable:

```bash
SOLIDUS_SDK_MODE=stub      # PostgreSQL-backed (development)
SOLIDUS_SDK_MODE=testnet   # Real blockchain (coming soon)
SOLIDUS_SDK_MODE=mainnet   # Production chain (future)
```

Applications built against the stub work identically against the real chain — zero code changes.

## Standards

- **W3C DIDs** — `did:solidus:<network>:<identifier>`
- **W3C Verifiable Credentials** — Data Model v2.0
- **Ed25519Signature2020** — Credential proofs
- **EdDSA JWTs** — Session tokens with DID claims

## License

Proprietary. All rights reserved. See [Solidus Network](https://github.com/solidusnetwork) for more information.
