# @solidus/sdk

The official SDK for the [Solidus Network](https://solidus.network) — a blockchain protocol for decentralized identity and verifiable credentials.

DID resolution, credential issuance, and on-chain verification, all behind one ergonomic client.

## Install

```bash
npm install @solidus/sdk
# or
pnpm add @solidus/sdk
```

## Quick start

```ts
import { createSdk } from '@solidus/sdk'

const solidus = createSdk({ mode: 'testnet' })

// Resolve a DID
const doc = await solidus.did.resolve('did:solidus:testnet:abc123')

// Issue a credential (as an authorized issuer)
const vc = await solidus.credentials.issue({
  subject: 'did:solidus:testnet:xyz789',
  type: ['VerifiableCredential', 'KYCVerified'],
  claims: { country: 'US', tier: 'standard' },
})

// Verify a credential
const result = await solidus.credentials.verify(vc)
if (result.valid) {
  // ok
}
```

## Modes

- **`stub`** — local Postgres-backed mock for development; no chain interaction.
- **`testnet`** — talks to the Solidus testnet via JSON-RPC at `rpc.solidus.network`.
- **`mainnet`** — reserved for the upcoming mainnet launch.

```ts
import { createSdk } from '@solidus/sdk'

const dev = createSdk({ mode: 'stub', databaseUrl: process.env.DATABASE_URL })
const live = createSdk({ mode: 'testnet' })
```

## Features

- DID create / resolve / deactivate
- Credential issue / verify / revoke / query
- DID-based authentication via [@solidus/auth](https://www.npmjs.com/package/@solidus/auth)
- Direct JSON-RPC chain queries
- Drop-in stub mode for local development

## Related packages

- [@solidus/auth](https://www.npmjs.com/package/@solidus/auth) — DID authentication primitives
- [@solidus/types](https://www.npmjs.com/package/@solidus/types) — shared TypeScript types

## Documentation

Full docs: [solidus.network](https://solidus.network) · [Whitepaper](https://github.com/solidusnetwork/docs/blob/main/whitepaper.md) · [Protocol spec](https://github.com/solidusnetwork/docs/blob/main/protocol.md)

## License

Apache-2.0 — see [LICENSE](./LICENSE).
