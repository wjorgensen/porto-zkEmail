import { createConfig, http } from 'wagmi';
import { createClient } from 'viem';
import { ANVIL_CHAIN } from './contracts';
import { portoConnector } from './porto';
import { anvilV2 } from '../../porto/src/core/ChainsV2';

export const wagmiConfig = createConfig({
  chains: [anvilV2],
  connectors: [portoConnector],
  transports: {
    [anvilV2.id]: http('http://localhost:8545')
  }
});