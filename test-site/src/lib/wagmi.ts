import { createConfig, http } from 'wagmi';
import { ANVIL_CHAIN } from './contracts';
import { portoConnector } from './porto';

export const wagmiConfig = createConfig({
  chains: [ANVIL_CHAIN],
  connectors: [portoConnector],
  transports: {
    [ANVIL_CHAIN.id]: http('http://localhost:8545')
  },
  ssr: true // Enable SSR mode to prevent auto-reconnect issues
});