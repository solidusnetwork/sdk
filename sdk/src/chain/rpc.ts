/**
 * JSON-RPC 2.0 HTTP client for communicating with the Solidus chain node.
 */
export class RpcClient {
  constructor(private rpcUrl: string) {}

  async call<T>(method: string, params: unknown[]): Promise<T> {
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: Date.now() }),
    })

    if (!res.ok) {
      throw new Error(`RPC HTTP error: ${res.status} ${res.statusText}`)
    }

    const json = (await res.json()) as { result?: T; error?: { code: number; message: string } }
    if (json.error) {
      throw new Error(`RPC error ${json.error.code}: ${json.error.message}`)
    }
    return json.result as T
  }
}
