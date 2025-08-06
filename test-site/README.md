# Porto zkEmail Test Site

This is a demo website for testing the Porto zkEmail integration.

## Setup Complete

### Deployed Contracts (on local Anvil)

- **IthacaFactoryV2**: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **Orchestrator**: `0x818C9339ABC63C46Fe06B0CE2DE5c0b20f23923E`
- **ZKEmailVerifier**: `0x83480CaAb6E6FE4Eff480fc0ee17379EED25572a`
- **IthacaAccountV2**: `0x564F8b8957Bf03Cd02Cf055dB3B9F9f30dC6037E`
- **Account Proxy**: `0xF5a71C6794A476a26C42Af3a08a3a86352312c95`
- **Simulator**: `0xe57A682645C908c104dE589C805C99a7bB5E6DD0`
- **Test Token (PTT)**: `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`

### Features Implemented

1. **Signup Flow**:
   - Passkey creation (simulated)
   - Email verification (simulated)
   - zkEmail proof generation (simulated)
   - Account deployment with EIP-7702

2. **Login Flow**:
   - Device discovery
   - Passkey authentication

3. **Dashboard**:
   - Token balance display
   - Mint test tokens
   - Transfer tokens

### Running the Demo

1. Make sure Anvil is running:
   ```bash
   anvil --accounts 10 --balance 10000 --port 8545
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000)

4. Connect your wallet (MetaMask) to localhost:8545

5. Follow the signup flow

### Important Notes

This is a simplified demo with several limitations:

1. **Email Infrastructure**: The demo simulates email sending/receiving. In production, you would need:
   - An email service (SendGrid, AWS SES, etc.) to send emails
   - An email server or service to receive replies
   - A backend service to monitor emails and trigger proof generation

2. **Proof Generation**: The demo simulates zkEmail proof generation. In production:
   - Client-side proofs take 20-30 seconds for simple proofs
   - Complex proofs can take 3+ minutes
   - Server-side proof generation with GPU is recommended (< 8 seconds)

3. **zkEmail SDK Integration**: The actual zkEmail SDK requires:
   - Email blueprints for defining verification patterns
   - Domain approval for Gmail integration
   - Proof verification contracts deployment

4. **Porto SDK**: The full Porto SDK wasn't integrated due to Node version requirements. In production, you would use the Porto SDK for proper account management.

### What Would Be Needed for Production

1. **Email Server Setup**:
   - Backend service to send emails with unique challenge codes
   - Email monitoring service (IMAP/Gmail API) to detect replies
   - Queue system to handle proof generation requests

2. **Proof Generation Service**:
   - Server with GPU for fast proof generation
   - zkEmail circuits deployment
   - Blueprint registration in zkEmail registry

3. **Proper Integration**:
   - Full Porto SDK integration
   - Actual WebAuthn implementation for passkeys
   - Proper EIP-7702 transaction handling
   - Account state management

4. **Security**:
   - Rate limiting for email requests
   - Proper nonce management
   - Secure key storage
   - Email privacy (only hash stored on-chain)

### Contract Architecture

The system uses the Porto V2 architecture:
- **IthacaAccountV2**: Extends IthacaAccount with email registration
- **EmailModule**: Handles zkEmail verification (integrated in V2)
- **ZKEmailVerifier**: Mock Groth16 verifier for email proofs
- **EIP-7702**: Links EOA to proxy contract for account abstraction

This demo provides a foundation for understanding the flow, but requires additional infrastructure for a production deployment.