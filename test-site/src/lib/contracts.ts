// Contract addresses from deployment
export const CONTRACTS = {
  factory: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  orchestrator: "0x818C9339ABC63C46Fe06B0CE2DE5c0b20f23923E",
  zkEmailVerifier: "0x83480CaAb6E6FE4Eff480fc0ee17379EED25572a",
  accountImplementation: "0x564F8b8957Bf03Cd02Cf055dB3B9F9f30dC6037E",
  accountProxy: "0xF5a71C6794A476a26C42Af3a08a3a86352312c95",
  simulator: "0xe57A682645C908c104dE589C805C99a7bB5E6DD0",
  testToken: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
} as const;

// Chain configuration
export const ANVIL_CHAIN = {
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://localhost:8545'] },
    public: { http: ['http://localhost:8545'] }
  },
  blockExplorers: {
    default: { name: 'Anvil', url: 'http://localhost:8545' }
  }
} as const;
