import { Porto } from '../../porto/src/core/Porto';
import { PortoConnectorV2 } from '../../porto/src/wagmi/ConnectorV2';
import { anvilV2 } from '../../porto/src/core/ChainsV2';

// Initialize Porto instance with V2 configuration
export const porto = new Porto({
  chains: [anvilV2],
  mode: 'contract', // Use contract mode for on-chain operations
});

// Create enhanced Porto V2 connector for wagmi
export const portoConnector = PortoConnectorV2({
  porto,
  emailModule: anvilV2.contracts?.zkEmailVerifier?.address,
  options: {
    name: 'Porto Account V2',
    shimDisconnect: true,
  }
});