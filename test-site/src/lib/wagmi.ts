import { createConfig, http } from 'wagmi';
import { createClient } from 'viem';
import { ANVIL_CHAIN } from './contracts';

export const wagmiConfig = createConfig({
  chains: [ANVIL_CHAIN],
  transports: {
    [ANVIL_CHAIN.id]: http('http://localhost:8545')
  }
});