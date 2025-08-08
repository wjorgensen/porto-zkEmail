# Porto zkEmail Integration

Porto zkEmail is a revolutionary account abstraction system that combines the security of blockchain technology with the familiarity of email-based authentication. This project demonstrates how to create passwordless, smart contract accounts using email verification and passkeys (WebAuthn), backed by zero-knowledge proofs.

## 🌟 Overview

The project integrates **Porto's account abstraction framework** with **zkEmail technology** to enable:

- **Passwordless Authentication**: No private keys or seed phrases to manage
- **Email-Based Account Recovery**: Recover your account using email verification
- **Passkey Security**: Biometric authentication (Touch ID, Face ID, Windows Hello)
- **Zero-Knowledge Proofs**: Email verification powered by ZK-SNARKs
- **EIP-7702 Account Abstraction**: Smart accounts with custom validation logic
- **Gas Sponsorship**: Transactions sponsored by the protocol

### Key Features

- 🔐 **No Private Keys**: Accounts controlled entirely by passkeys and email verification
- 📧 **zkEmail Proofs**: Cryptographically verify email contents without revealing metadata  
- 🧬 **Smart Accounts**: EIP-7702 compatible accounts with custom validation logic
- ⚡ **Fast Onboarding**: Create accounts in seconds using just email + biometrics
- 🛡️ **Recovery System**: Recover accounts using email verification if device is lost
- 🔗 **On-Chain Storage**: All account data stored on blockchain (no localStorage)

## 🏗️ Architecture

The system consists of three main components:

### 1. Email Infrastructure (`email-infrastructure/`)
- **Email Monitor**: Polls IMAP for verification replies
- **ZK Proof Generator**: Creates SNARK proofs from email headers using Circom circuits
- **Email Sender**: Sends verification emails via SMTP
- **Verification API**: REST endpoints for email verification flow

### 2. Smart Contracts (`porto/contracts/accountV2/`)
- **IthacaAccountV2**: Main account contract with passkey and email support
- **EmailModuleV2**: Email verification and recovery logic
- **ZKEmailVerifierV2**: On-chain verification of zkEmail proofs
- **DeploymentHelper**: Utilities for account deployment

### 3. Frontend Application (`test-site/`)
- **React/Next.js**: Modern web interface
- **WebAuthn Integration**: Passkey creation and authentication
- **Account Dashboard**: View passkeys, transactions, and account info
- **Wagmi/Viem**: Ethereum interaction and wallet management

## 🚀 Getting Started

### Prerequisites

Before running the project locally, ensure you have:

- **Node.js 18+** and **npm**
- **Git**
- **Gmail account** with App Password enabled
- **Foundry** for smart contract compilation
- **A modern browser** with WebAuthn support

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/porto-zkEmail.git
   cd porto-zkEmail
   ```

2. **Install dependencies for all components**
   ```bash
   # Root level dependencies
   npm install
   
   # Email infrastructure
   cd email-infrastructure
   npm install
   cd ..
   
   # Frontend application
   cd test-site
   npm install
   cd ..
   ```

3. **Install Foundry (for smart contracts)**
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

4. **Setup Gmail App Password**
   - Enable 2-Factor Authentication on your Gmail account
   - Generate an App Password: [Google Account Settings](https://myaccount.google.com/apppasswords)
   - Save the 16-character app password for configuration

### Configuration

1. **Create email infrastructure environment file**
   ```bash
   cd email-infrastructure
   cp .env.example .env
   ```

2. **Configure email settings in `email-infrastructure/.env`**
   ```bash
   # Gmail configuration
   GMAIL_USER=your.email@gmail.com
   GMAIL_APP_PASSWORD=your-16-char-app-password
   
   # SMTP settings (Gmail defaults)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   
   # IMAP settings (Gmail defaults)
   IMAP_HOST=imap.gmail.com
   IMAP_PORT=993
   
   # Server port
   EMAIL_SERVER_PORT=3001
   ```

### Running the Project

The project requires running multiple services simultaneously. Use the provided start script:

```bash
# Start all services (Anvil, email infrastructure, and frontend)
chmod +x start.sh
./start.sh
```

Or start each service manually:

1. **Start local blockchain (Anvil with EIP-7702 support)**
   ```bash
   anvil --accounts 10 --balance 10000 --chain-id 31337 --port 8545 --hardfork prague
   ```

2. **Deploy smart contracts**
   ```bash
   cd porto/contracts/accountV2
   forge build
   forge script script/DeployAll.s.sol --broadcast --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   cd ../../..
   ```

3. **Start email infrastructure**
   ```bash
   cd email-infrastructure
   npm start
   ```

4. **Start frontend application**
   ```bash
   cd test-site
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Email API: http://localhost:3001
   - Anvil RPC: http://localhost:8545

### Testing the Flow

1. **Create Account**
   - Visit http://localhost:3000
   - Enter your email address
   - Create a passkey (Touch ID/Face ID)
   - Reply to the verification email
   - Wait for zkProof generation and account deployment

2. **Login**
   - Use your passkey to authenticate
   - View your account dashboard
   - See registered passkeys and email verification status

3. **Recovery (Future)**
   - Email-based account recovery will be added in future updates

## 🏛️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 Porto zkEmail                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────────────┐  │
│  │   Frontend      │    │  Email Infra     │    │     Blockchain             │  │
│  │   (Next.js)     │    │  (Node.js)       │    │     (Anvil)                │  │
│  │                 │    │                  │    │                            │  │
│  │ ┌─────────────┐ │    │ ┌──────────────┐ │    │ ┌─────────────────────────┐ │  │
│  │ │ Signup Flow │ │◄───┤ │ Email Sender │ │    │ │  IthacaAccountV2       │ │  │
│  │ └─────────────┘ │    │ └──────────────┘ │    │ │  (Smart Account)       │ │  │
│  │ ┌─────────────┐ │    │ ┌──────────────┐ │    │ └─────────────────────────┘ │  │
│  │ │ WebAuthn    │ │    │ │ Email Monitor│ │    │ ┌─────────────────────────┐ │  │
│  │ │ (Passkeys)  │ │    │ │ (IMAP Poll)  │ │    │ │  ZKEmailVerifierV2     │ │  │
│  │ └─────────────┘ │    │ └──────────────┘ │    │ │  (Proof Verification)  │ │  │
│  │ ┌─────────────┐ │    │ ┌──────────────┐ │    │ └─────────────────────────┘ │  │
│  │ │ Dashboard   │ │◄───┤ │ ZK Proof Gen │ │    │ ┌─────────────────────────┐ │  │
│  │ │ (Account)   │ │    │ │ (Circom)     │ │    │ │  EmailModuleV2         │ │  │
│  │ └─────────────┘ │    │ └──────────────┘ │    │ │  (Email Recovery)      │ │  │
│  │                 │    │                  │    │ └─────────────────────────┘ │  │
│  └─────────────────┘    └──────────────────┘    └─────────────────────────────┘  │
│                                                                                 │
│                          Data Flow:                                             │
│  1. User enters email  ──→  Verification email sent                             │
│  2. User creates passkey  ──→  WebAuthn credential                              │
│  3. User replies to email  ──→  ZK proof generated                              │
│  4. Account deployed with EIP-7702  ──→  Smart account created                  │
│  5. Passkey & email registered on-chain  ──→  Account ready                     │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### System Flow

1. **Account Creation**
   ```
   Email Input → Passkey Creation → Email Verification → 
   ZK Proof Generation → EIP-7702 Deployment → On-chain Registration
   ```

2. **Authentication**
   ```
   Passkey Challenge → WebAuthn Verification → 
   Smart Account Interaction → Transaction Signing
   ```

3. **Email Verification Process**
   ```
   SMTP Send → IMAP Monitor → Reply Detection → 
   Circuit Processing → SNARK Generation → On-chain Verification
   ```

### Technical Stack

- **Frontend**: Next.js 14, React 18, TailwindCSS, Wagmi v2
- **Blockchain**: Anvil (local), Foundry, Solidity 0.8.24+
- **zkProofs**: Circom, SnarkJS, Groth16
- **Email**: Nodemailer, IMAP, Gmail API
- **Authentication**: WebAuthn API, Passkeys
- **Account Abstraction**: EIP-7702, Porto Framework

## 🔧 Development

### Project Structure

```
porto-zkEmail/
├── email-infrastructure/       # Email monitoring and ZK proof generation
│   ├── src/
│   │   ├── server.js           # Express API server
│   │   ├── emailSender.js      # SMTP email sending
│   │   ├── emailMonitor.js     # IMAP email monitoring
│   │   ├── zkProofService.js   # ZK proof generation
│   │   └── utils/              # Crypto utilities
│   ├── circuit/                # Circom circuits for zkEmail
│   └── .env.example            # Environment configuration
├── test-site/                  # React frontend application
│   ├── src/
│   │   ├── components/         # UI components
│   │   ├── hooks/              # React hooks
│   │   └── lib/                # Utilities and configurations
│   └── package.json
├── porto/                      # Porto framework and contracts
│   └── contracts/accountV2/    # Smart contract implementations
└── start.sh                    # Development startup script
```

### Environment Variables

All environment variables are configured in `email-infrastructure/.env`:

```bash
# Required Gmail Configuration
GMAIL_USER=your.email@gmail.com
GMAIL_APP_PASSWORD=your-app-password

# SMTP Configuration (defaults to Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587

# IMAP Configuration (defaults to Gmail)  
IMAP_HOST=imap.gmail.com
IMAP_PORT=993

# Server Configuration
EMAIL_SERVER_PORT=3001
```

### Smart Contract Deployment

Contracts are automatically deployed when running `start.sh`. For manual deployment:

```bash
cd porto/contracts/accountV2
forge build
forge script script/DeployAll.s.sol --broadcast --rpc-url http://localhost:8545
```

### Circuit Compilation

ZK circuits are pre-compiled. To recompile:

```bash
cd email-infrastructure/circuit
circom circuit.circom --r1cs --wasm --sym
snarkjs groth16 setup circuit.r1cs ptau/ceremony_final.ptau circuit_final.zkey
```

## 🛠️ Troubleshooting

### Common Issues

1. **WebAuthn not working**
   - Ensure you're using HTTPS or localhost
   - Check browser WebAuthn support
   - Try different authenticator types

2. **Email verification failing**
   - Verify Gmail App Password is correct
   - Check IMAP/SMTP settings
   - Ensure 2FA is enabled on Gmail account

3. **Contract deployment errors**
   - Ensure Anvil is running with Prague hardfork
   - Check that accounts have sufficient ETH
   - Verify contract compilation with `forge build`

4. **ZK proof generation slow**
   - Circuit compilation can take several minutes
   - Ensure sufficient system memory (4GB+ recommended)
   - Check circuit files are properly generated

### Debug Endpoints

The email infrastructure provides debug endpoints:

- `GET /debug/check-emails` - Manually trigger email check
- `GET /debug/pending` - View all pending verifications  
- `GET /saved-emails` - List all saved email files

## 📝 License

This project is licensed under the MIT License. See individual component licenses for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📚 Additional Resources

- [Porto Documentation](https://docs.porto.sh)
- [zkEmail Documentation](https://docs.zkemail.xyz)
- [WebAuthn Guide](https://webauthn.guide)
- [EIP-7702 Specification](https://eips.ethereum.org/EIPS/eip-7702)
- [Account Abstraction Overview](https://ethereum.org/en/roadmap/account-abstraction/)

---

Built with ❤️ using Porto, zkEmail, and the Ethereum ecosystem.