import { createConnector } from 'wagmi';
import { getAddress } from 'viem';

// V2 Contract addresses on Anvil
const V2_CONTRACTS = {
  account: '0xF5a71C6794A476a26C42Af3a08a3a86352312c95',
  orchestrator: '0x818C9339ABC63C46Fe06B0CE2DE5c0b20f23923E',
  factory: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  zkEmailVerifier: '0x83480CaAb6E6FE4Eff480fc0ee17379EED25572a',
};

// Create Porto V2 connector for wagmi
export const portoConnector = createConnector((config) => ({
  id: 'porto-v2',
  name: 'Porto Account V2',
  type: 'injected',
  
  async connect() {
    // For demo, we use the deployed account proxy
    // In production with EIP-7702, this would be the user's EOA
    return {
      accounts: [getAddress(V2_CONTRACTS.account)],
      chainId: 31337, // Anvil chain ID
    };
  },

  async disconnect() {
    // No-op for testing
  },

  async getAccounts() {
    // Return the account address - all data is on-chain
    return [getAddress(V2_CONTRACTS.account)];
  },

  async getChainId() {
    return 31337;
  },

  async isAuthorized() {
    return true; // For testing
  },

  async switchChain({ chainId }) {
    return config.chains.find((c) => c.id === chainId)!;
  },

  async onAccountsChanged() {},
  async onChainChanged() {},
  async onDisconnect() {},

  async getProvider() {
    if (typeof window === 'undefined') return undefined;
    return window.ethereum;
  },
}));