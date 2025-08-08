import type { Chain as Chain_viem, ChainContract } from 'viem'
import * as chains from 'viem/chains'

export type ChainV2 = Chain_viem & {
  contracts?:
    | (Chain_viem['contracts'] & {
        portoAccount?: ChainContract | undefined
        orchestrator?: ChainContract | undefined
        factory?: ChainContract | undefined
        zkEmailVerifier?: ChainContract | undefined
        simulator?: ChainContract | undefined
      })
    | undefined
}

export function defineV2<const chain extends ChainV2>(chain: chain): chain {
  return chain
}

// Local Anvil chain with IthacaAccountV2 contracts
export const anvilV2 = /*#__PURE__*/ defineV2({
  ...chains.anvil,
  contracts: {
    ...chains.anvil.contracts,
    // Account implementation (IthacaAccountV2)
    portoAccount: {
      address: '0x564F8b8957Bf03Cd02Cf055dB3B9F9f30dC6037E',
    },
    // Orchestrator for gas sponsorship
    orchestrator: {
      address: '0x818C9339ABC63C46Fe06B0CE2DE5c0b20f23923E',
    },
    // Factory for account deployment
    factory: {
      address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    },
    // zkEmail verifier for email proofs
    zkEmailVerifier: {
      address: '0x83480CaAb6E6FE4Eff480fc0ee17379EED25572a',
    },
    // Simulator for transaction simulation
    simulator: {
      address: '0xe57A682645C908c104dE589C805C99a7bB5E6DD0',
    },
  },
  rpcUrls: {
    default: {
      http: ['http://localhost:8545'], // Standard Anvil port
    },
  },
})

// Export the deployed proxy account for reference
export const DEPLOYED_ACCOUNT_PROXY = '0xF5a71C6794A476a26C42Af3a08a3a86352312c95'