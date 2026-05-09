# @solidus/types

TypeScript types for the [Solidus Network](https://solidus.network) protocol.

## Install

```bash
npm install @solidus/types
# or
pnpm add @solidus/types
```

## What's in here

Shared type definitions used across the Solidus SDK and downstream consumers:

- **DIDs** — `DID`, `DIDDocument`, `DIDMethod`
- **Verifiable Credentials** — `VerifiableCredential`, `IssueCredentialParams`, `VerificationResult`
- **Authentication** — `AuthChallenge`, `AuthResult`

## Usage

```ts
import type { DID, VerifiableCredential, VerificationResult } from '@solidus/types'
```

## License

Apache-2.0 — see [LICENSE](./LICENSE).
