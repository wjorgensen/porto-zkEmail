# Porto zkEmail Demo Setup

This repository contains a complete demo of Porto's zkEmail integration with email-based account recovery.

## Project Structure

```
porto-zk/
├── porto/                      # Porto SDK (git submodule)
├── porto/contracts/accountV2/  # V2 contracts with zkEmail
├── test-site/                  # Next.js demo website
├── email-infrastructure/       # Email server & proof generation
└── start-local-env.sh         # One-click deployment script
```

## Quick Start

### 1. Start Local Environment

```bash
./start-local-env.sh
```

This script will:
- Kill any existing Anvil processes on port 8545
- Start a fresh Anvil instance
- Deploy all contracts (IthacaAccountV2, zkEmail verifier, test token)
- Update contract addresses in test-site
- Update email infrastructure config (if .env exists)

### 2. Setup Email Infrastructure

```bash
cd email-infrastructure

# Copy and configure environment
cp .env.sample .env
# Edit .env with your Gmail credentials (see setup.md)

# Install dependencies
npm install

# Start email server
npm start
```

### 3. Run Test Website

```bash
cd test-site

# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

Open http://localhost:3000 in your browser.

## Demo Flow

1. **Connect Wallet**: Connect MetaMask to localhost:8545
2. **Sign Up**:
   - Create a passkey (simulated)
   - Enter email address
   - Receive verification email
   - Reply to email (or click "Simulate Reply" in demo)
   - Account created with EIP-7702
3. **Dashboard**:
   - Mint test tokens
   - Transfer tokens

## Architecture

### Smart Contracts

- **IthacaAccountV2**: Extends IthacaAccount with email registration
- **ZKEmailVerifier**: Verifies zkEmail proofs on-chain
- **EIP-7702 Proxy**: Links EOA to account implementation

### Email Flow

```
User Email → Gmail SMTP → Email Server → IMAP Monitor → Proof Generator → Blockchain
```

### Key Components

1. **Deployment Script** (`start-local-env.sh`):
   - Automated contract deployment
   - Address management
   - Environment setup

2. **Email Infrastructure**:
   - SMTP sender for verification emails
   - IMAP monitor for reply detection
   - Mock proof generator (GPU/CPU modes)
   - REST API for frontend integration

3. **Test Website**:
   - Signup/login flows
   - Passkey simulation
   - Token operations

## Production Requirements

This demo simulates several components. For production:

1. **zkEmail Circuits**:
   - Download/generate actual circuits
   - Register blueprints with zkEmail
   - Set up GPU server for <8s proof generation

2. **Email Service**:
   - Production email service (SendGrid, SES)
   - Scalable queue system
   - Rate limiting and monitoring

3. **Porto SDK Integration**:
   - Full SDK with proper key management
   - WebAuthn implementation
   - EIP-7702 transaction handling

4. **Security**:
   - Secure key storage
   - Email privacy (only hashes on-chain)
   - Nonce management
   - Rate limiting

## Troubleshooting

### Anvil Issues
```bash
# Check if Anvil is running
lsof -i :8545

# Kill existing Anvil
kill $(lsof -t -i :8545)
```

### Contract Deployment
```bash
# Check deployment logs
cat /tmp/anvil.log

# Manually deploy
cd porto/contracts/accountV2
forge script script/DeployAll.s.sol --rpc-url http://localhost:8545 --broadcast
```

### Email Server
- Check Gmail app password is correct
- Verify IMAP is enabled
- Check `email-infrastructure/logs/server.log`

## Important Notes

- **Demo Mode**: Many components are simulated for ease of testing
- **Gas**: All operations use Anvil's unlimited gas
- **Emails**: Use a dedicated Gmail account, not personal
- **Proofs**: Simulated with delays (5s GPU, 20s CPU)

## Next Steps

To productionize this demo:

1. Implement actual zkEmail proof generation
2. Set up production email infrastructure
3. Deploy to testnet (Base Sepolia recommended)
4. Integrate full Porto SDK
5. Implement proper WebAuthn
6. Add monitoring and analytics

## Contract Addresses

After running `start-local-env.sh`, find addresses in:
- `deployment-info.json`
- `test-site/src/lib/contracts.ts`

## Support

- Porto Docs: https://porto.sh
- zkEmail Docs: https://docs.zk.email/
- GitHub Issues: https://github.com/wevm/porto