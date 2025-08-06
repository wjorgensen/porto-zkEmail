# Porto zkEmail Architecture Overview

## Complete System Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            USER SIGNUP FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  1. User visits http://localhost:3000                                        │
│     └─> Next.js app (test-site/)                                            │
│                                                                               │
│  2. User clicks "Sign Up"                                                    │
│     ├─> Creates passkey (WebAuthn simulation)                               │
│     └─> Enters email address                                                │
│                                                                               │
│  3. Frontend calls email service API                                         │
│     └─> POST http://localhost:3001/send-verification                        │
│         └─> Email service sends via Gmail SMTP                              │
│                                                                               │
│  4. Email sent to user                                                       │
│     Subject: PORTO-AUTH-123456                                               │
│     From: yexfinance@gmail.com                                               │
│     Body: PORTO|31337|0x...|setEmail|0x0|nonce|timestamp|0x0               │
│                                                                               │
│  5. User replies to email                                                    │
│     └─> Gmail receives reply                                                 │
│         └─> IMAP monitor detects (polling)                                   │
│             └─> Extracts data using blueprint regex                         │
│                                                                               │
│  6. Proof generation triggered                                               │
│     └─> Mock proof generated (5s GPU / 20s CPU simulation)                  │
│         └─> In production: zkEmail circuit on GPU server                    │
│                                                                               │
│  7. Account deployment                                                       │
│     ├─> Generate new EOA (ephemeral private key)                            │
│     ├─> Deploy EIP-7702 proxy (points to IthacaAccountV2)                  │
│     ├─> Send EIP-7702 authorization transaction                             │
│     └─> Call registerEmailAndPasskey with proof                             │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Smart Contracts (Anvil - Port 8545)

```
┌─────────────────────────────────────────────────────────────┐
│                    DEPLOYED CONTRACTS                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  IthacaFactoryV2                                             │
│  └─> Deploys all other contracts deterministically           │
│                                                               │
│  Orchestrator                                                │
│  └─> Manages gas sponsorship and execution coordination      │
│                                                               │
│  IthacaAccountV2 (Implementation)                            │
│  ├─> Extends IthacaAccount with email functions              │
│  ├─> setEmail() - one-time email registration               │
│  ├─> addPasskeyWithEmail() - add device with email proof    │
│  └─> revokePasskeyWithEmail() - revoke with email proof     │
│                                                               │
│  ZKEmailVerifier                                             │
│  └─> Mock Groth16 verifier for email proofs                 │
│                                                               │
│  EIP-7702 Proxy (per user)                                  │
│  ├─> Deployed using LibEIP7702.proxyInitCode()              │
│  ├─> Points to IthacaAccountV2 implementation               │
│  └─> Links user's EOA to smart account logic                │
│                                                               │
│  TestToken (PTT)                                             │
│  └─> ERC20 for testing transfers                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 2. Web Application (Next.js - Port 3000)

```
test-site/
├── src/
│   ├── app/
│   │   ├── page.tsx          # Main entry point
│   │   └── providers.tsx     # Wagmi/React Query setup
│   ├── components/
│   │   ├── SignupFlow.tsx    # Passkey + Email verification
│   │   ├── LoginFlow.tsx     # Device selection
│   │   └── Dashboard.tsx     # Token operations
│   └── lib/
│       ├── contracts.ts      # Contract addresses
│       └── wagmi.ts          # Web3 configuration
```

**Key Features:**
- Wallet connection (MetaMask)
- Passkey creation (simulated WebAuthn)
- Email verification flow
- Token minting and transfers

### 3. Email Infrastructure (Express - Port 3001)

```
email-infrastructure/
├── src/
│   ├── server.js           # Express API server
│   ├── emailSender.js      # SMTP (Gmail) sender
│   ├── emailMonitor.js     # IMAP inbox monitor
│   ├── proofGenerator.js   # Mock zkEmail proofs
│   └── parseEmail.js       # Email parsing logic
├── blueprints/
│   └── porto-auth.json     # zkEmail blueprint config
```

**API Endpoints:**
- `POST /send-verification` - Send auth email
- `GET /verification-status/:nonce` - Check status
- `POST /generate-proof` - Manual proof trigger

### 4. zkEmail Blueprint

The blueprint (`porto-auth.json`) defines:

```json
{
  "emailQuery": {
    "subject": "PORTO-AUTH-*",
    "from": "yexfinance@gmail.com"
  },
  "extractors": [
    {
      "name": "authCode",
      "regex": "PORTO-AUTH-([0-9]{6})",
      "location": "subject"
    },
    {
      "name": "walletAddress",
      "regex": "PORTO\\|[0-9]+\\|([0-9a-fA-Fx]+)\\|",
      "location": "body"
    }
  ],
  "publicInputs": ["authCode", "walletAddress", "action"]
}
```

### 5. Data Flow

```
1. USER ACTION
   │
   ├─> Web App (localhost:3000)
   │   └─> Wagmi/Viem calls
   │
   ├─> Email Service (localhost:3001)
   │   ├─> Send: Gmail SMTP
   │   └─> Receive: Gmail IMAP
   │
   └─> Blockchain (localhost:8545)
       └─> Contract interactions

2. EMAIL FLOW
   Send ──> Gmail ──> User Inbox
                         │
                         └─> User Reply
                              │
   IMAP Monitor <────────────┘
        │
        └─> Parse & Extract
             │
             └─> Generate Proof
                  │
                  └─> Submit to Chain

3. ACCOUNT CREATION
   EOA Generation ──> Proxy Deployment ──> EIP-7702 Auth
                           │
                           └─> Points to IthacaAccountV2
                                    │
                                    └─> Register Email + Passkey
```

### 6. Storage Model

```
User EOA Storage (via EIP-7702):
├── Keys (EnumerableSet)
│   ├── Passkey 1 (with keyId)
│   ├── Passkey 2 (with keyId)
│   └── Session keys
├── Email Hash (bytes32)
├── Email Nonce (uint64)
└── Rate Limits (timestamps)
```

### 7. Security Model

1. **Email Verification**:
   - DKIM signature proves email authenticity
   - zkProof hides email content, reveals only necessary data
   - One-time email registration (can't be changed)

2. **Key Management**:
   - Multiple passkeys per account
   - Email proof required for adding/revoking keys
   - Rate limiting (5 keys per week)

3. **Recovery Flow**:
   - Lose device → Use email to add new passkey
   - Email as root of trust
   - No centralized recovery service

### 8. Production vs Demo

**Demo (Current)**:
- Mock passkey creation
- Simulated proof generation (5-20s delay)
- Direct token transfers (not via account)
- Manual email reply simulation

**Production (Requires)**:
- Real WebAuthn implementation
- GPU server for proof generation (your RTX 2060)
- zkEmail circuit deployment
- Actual IMAP monitoring
- EIP-7702 transaction handling

### 9. GPU Server Integration

When ready for production on your server (192.168.1.75):

```bash
# SSH to your server
ssh -i ~/.ssh/homeServerKey wes@192.168.1.75

# Run GPU setup
cd ~/porto-gpu-prover
./setup-gpu-server.sh

# This creates API on port 3003
# Update email service to call GPU server instead of mock
```

The GPU server will:
- Generate real zkEmail proofs in 5-10s
- Handle concurrent proof requests
- Verify DKIM signatures
- Return Groth16 proofs for on-chain verification

### 10. Complete Startup

```bash
# One command to start everything
./start-all.sh

# This runs in tmux:
# - Window 0: Anvil blockchain
# - Window 1: Email service
# - Window 2: Web application

# To monitor:
tmux attach -t porto

# To stop everything:
./kill-all.sh
```

## Summary

The Porto zkEmail integration creates a decentralized account system where:
1. **Email is the recovery root** - Lose your device, use email to recover
2. **No passwords** - WebAuthn passkeys for daily use
3. **Zero-knowledge** - Email content stays private, only proof goes on-chain
4. **EIP-7702** - EOAs become smart accounts without address change
5. **Gasless** - Orchestrator sponsors transactions

This architecture eliminates seed phrases while maintaining full self-custody through the combination of passkeys (convenience) and email (recovery).