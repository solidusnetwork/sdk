/**
 * Chain-backed SolidusSDK client factory.
 *
 * Creates an SDK instance that communicates with the Solidus blockchain
 * via JSON-RPC, replacing the PostgreSQL-backed stub for testnet/mainnet.
 */
import { RpcClient } from './rpc.js'
import { createChainDid } from './did.js'
import { createChainCredentials } from './credentials.js'
import { createChainAuth } from './auth.js'
import { createChainBbs } from './bbs.js'
import { getAddressFromKey } from './transaction.js'
import type { SolidusSDK } from '../index.js'

export interface ChainConfig {
  /** JSON-RPC endpoint URL of the Solidus chain node. */
  rpcUrl: string
  /** Hex-encoded 32-byte Ed25519 private key used for signing transactions. */
  signerPrivateKey: string
  /** Network identifier (used in DID strings). */
  network: 'testnet' | 'mainnet'
  /** Base58 sender address. Computed from signerPrivateKey if not provided. */
  signerAddress?: string
}

export function createChainClient(config: ChainConfig): SolidusSDK {
  const rpc = new RpcClient(config.rpcUrl)
  return {
    did: createChainDid(rpc, config),
    credentials: createChainCredentials(rpc, config),
    auth: createChainAuth(rpc, config),
    bbs: createChainBbs(rpc, config),
  }
}
