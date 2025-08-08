// Simple Porto configuration without complex imports
import { createConnector } from 'wagmi';
import { getAddress } from 'viem';

export const simplePortoConnector = createConnector((config) => ({
  id: 'simple-porto',
  name: 'Porto Account',
  type: 'injected',
  
  async connect() {
    // For testing, just return a mock account
    const mockAddress = '0xF5a71C6794A476a26C42Af3a08a3a86352312c95';
    
    return {
      accounts: [getAddress(mockAddress)],
      chainId: 31337, // Anvil chain ID
    };
  },

  async disconnect() {
    // No-op for now
  },

  async getAccounts() {
    return [getAddress('0xF5a71C6794A476a26C42Af3a08a3a86352312c95')];
  },

  async getChainId() {
    return 31337;
  },

  async isAuthorized() {
    return true;
  },

  async switchChain({ chainId }) {
    return config.chains.find((c) => c.id === chainId)!;
  },

  async onAccountsChanged() {},
  async onChainChanged() {},
  async onDisconnect() {},

  getProvider() {
    if (typeof window === 'undefined') return undefined;
    return window.ethereum;
  },
}));