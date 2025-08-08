import type * as Address from 'ox/Address'
import { createConnector } from '@wagmi/core'
import { getAddress } from 'viem'
import type * as Porto from '../core/Porto.js'
import { anvilV2 } from '../core/ChainsV2.js'

// Use require for JSON import to avoid assertion issues
const IthacaAccountV2ABI = require('../../contracts/accountV2/src/IthacaAccountV2.abi.json')

export type ConnectorV2Parameters = {
  porto?: Porto.Porto
  emailModule?: Address.Address
  options?: {
    name?: string
    shimDisconnect?: boolean
  }
}

/**
 * Enhanced Porto connector for IthacaAccountV2 with email verification
 */
export function PortoConnectorV2(parameters: ConnectorV2Parameters = {}) {
  const { porto, emailModule, options = {} } = parameters
  const { name = 'Porto Account V2', shimDisconnect = false } = options

  let accountAddress: Address.Address | undefined
  let accountKeys: Key.Key[] = []

  return createConnector((config) => ({
    id: 'porto-v2',
    name,
    type: 'injected',
    
    async connect({ chainId } = {}) {
      const chain = config.chains.find((c) => c.id === (chainId || anvilV2.id))
      if (!chain) throw new Error('Chain not configured')

      // For demo, we'll return a mock account
      // In production, this would trigger the Porto dialog
      const mockAddress = '0xF5a71C6794A476a26C42Af3a08a3a86352312c95'
      accountAddress = mockAddress as Address.Address

      return {
        accounts: [getAddress(mockAddress)],
        chainId: chain.id,
      }
    },

    async disconnect() {
      accountAddress = undefined
      accountKeys = []
    },

    async getAccounts() {
      if (!accountAddress) return []
      return [getAddress(accountAddress)]
    },

    async getChainId() {
      return anvilV2.id
    },

    async isAuthorized() {
      return !!accountAddress
    },

    async switchChain({ chainId }) {
      const chain = config.chains.find((c) => c.id === chainId)
      if (!chain) throw new Error('Chain not configured')
      return chain
    },

    async onAccountsChanged(accounts) {
      if (accounts.length === 0) {
        await this.disconnect?.()
      }
    },

    async onChainChanged(chainId) {
      config.emitter.emit('change', { chainId: Number(chainId) })
    },

    async onDisconnect() {
      await this.disconnect?.()
    },

    /**
     * Get passkeys from on-chain storage
     */
    async getPasskeys() {
      if (!accountAddress) return []
      
      const client = config.getClient()
      
      try {
        const result = await client.readContract({
          address: accountAddress,
          abi: IthacaAccountV2ABI,
          functionName: 'getKeys',
        })
        
        const [keys, keyHashes] = result as [any[], string[]]
        
        return keys.map((key, index) => ({
          keyHash: keyHashes[index],
          key,
        }))
      } catch (error) {
        console.error('Failed to fetch passkeys:', error)
        return []
      }
    },

    /**
     * Register email and passkey on-chain
     */
    async registerEmailAndPasskey({
      email,
      emailProof,
      keyData,
      keyId,
    }: {
      email: string
      emailProof: string
      keyData: any // Passkey data structure
      keyId: string
    }) {
      if (!accountAddress) throw new Error('Account not connected')
      
      const client = config.getClient()
      
      // Call setEmailAndRegister on the account
      const hash = await client.writeContract({
        address: accountAddress,
        abi: IthacaAccountV2ABI,
        functionName: 'setEmailAndRegister',
        args: [emailProof, email, keyData, keyId],
      })
      
      return hash
    },

    /**
     * Revoke a passkey using signature from another key
     */
    async revokePasskey({
      keyHashToRevoke,
      signature,
    }: {
      keyHashToRevoke: string
      signature: string
    }) {
      if (!accountAddress) throw new Error('Account not connected')
      
      const client = config.getClient()
      
      const hash = await client.writeContract({
        address: accountAddress,
        abi: IthacaAccountV2ABI,
        functionName: 'revokePasskey',
        args: [keyHashToRevoke, signature],
      })
      
      return hash
    },

    getProvider() {
      if (typeof window === 'undefined') return undefined
      return window.ethereum
    },
  }))
}