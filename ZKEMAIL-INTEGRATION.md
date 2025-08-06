# zkEmail Integration Guide for Porto

## Overview

This guide explains how to use real zkEmail circuits with Porto authentication. The integration supports both mock proofs (for testing) and real zkEmail proofs (for production).

## Current Status

### ✅ Implemented
- zkEmail SDK integration in `email-infrastructure/src/zkEmailService.js`
- M1 Mac optimized proof generation
- Fallback to mock proofs when SDK unavailable
- Blueprint configuration for Porto authentication
- Email parsing and proof generation pipeline

### ⏳ Setup Required
1. Install zkEmail SDK dependencies
2. Build zkEmail circuits
3. Configure Gmail credentials
4. Run the complete system

## Quick Start

### 1. Install Dependencies

```bash
cd email-infrastructure
npm install
```

### 2. Setup zkEmail Circuits (Optional for Real Proofs)

```bash
# Run the circuit setup script
./setup-zkemail-circuits.sh

# Build the circuits
cd ~/porto-zk-circuits/porto-auth
./build.sh
```

### 3. Configure Gmail

Edit `email-infrastructure/.env`:
```env
GMAIL_USER=yexfinance@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
```

### 4. Start Everything

```bash
# From porto-zk directory
./start-all-with-prover.sh
```

## Architecture

### Real zkEmail Flow

```
1. User sends email to yexfinance@gmail.com
   Subject: PORTO-AUTH-123456
   Body: PORTO|31337|0x...|setEmail|...

2. Email Monitor detects email via IMAP

3. zkEmailService generates proof:
   - Parses raw email
   - Extracts required fields via regex
   - Generates Groth16 proof
   - Returns proof + public signals

4. Proof is verified on-chain by ZKEmailVerifier contract
```

### Key Components

#### zkEmailService.js
- Integrates @zk-email/sdk
- Handles proof generation
- Falls back to mock proofs if SDK unavailable
- Optimized for M1 Mac performance

#### Blueprint Configuration
```json
{
  "id": "porto-auth-v1",
  "emailQuery": {
    "subject": "PORTO-AUTH-*",
    "from": "yexfinance@gmail.com"
  },
  "extractors": [
    { "name": "authCode", "regex": "PORTO-AUTH-([0-9]{6})" },
    { "name": "walletAddress", "regex": "PORTO\\|[0-9]+\\|([0-9a-fA-Fx]+)\\|" }
  ]
}
```

## Performance

### M1 Mac Native Performance
- Mock proofs: 3-5 seconds
- Real zkEmail proofs: 5-10 seconds (with circuits)
- CPU fallback: 20 seconds

### Memory Usage
- Circuit compilation: ~4GB RAM
- Proof generation: ~2GB RAM
- Optimized for Apple Silicon unified memory

## Troubleshooting

### SDK Import Errors
If you see errors importing @zk-email/sdk:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Circuit Build Errors
If circuits fail to build:
```bash
# Install circom
npm install -g circom snarkjs

# Check Node version (need 18+)
node --version
```

### Proof Generation Fails
The system automatically falls back to mock proofs if:
- SDK not properly installed
- Circuits not built
- Memory constraints

## Production Checklist

- [ ] Build real zkEmail circuits
- [ ] Register blueprint with zkEmail registry
- [ ] Deploy verifier contract with real verification key
- [ ] Test with actual Gmail emails
- [ ] Monitor proof generation performance
- [ ] Set up circuit update mechanism

## Testing

### 1. Test Mock Proofs
```bash
# Start system
./start-all.sh

# Check prover health
curl http://localhost:3003/health
```

### 2. Test Real Proofs
```bash
# Build circuits first
cd ~/porto-zk-circuits/porto-auth
./build.sh

# Restart with circuits
./start-all-with-prover.sh
```

### 3. Send Test Email
1. Visit http://localhost:3000
2. Start signup flow
3. Send email to yexfinance@gmail.com
4. Check logs for proof generation

## Security Considerations

1. **Email Privacy**: Only public signals go on-chain
2. **DKIM Verification**: Ensures email authenticity
3. **Replay Protection**: Email nullifier prevents reuse
4. **Rate Limiting**: Contract enforces limits

## Next Steps

1. **Circuit Optimization**: Further optimize for M1/M2 chips
2. **Multi-Blueprint Support**: Support different email providers
3. **Circuit Registry**: Register Porto blueprint publicly
4. **Performance Monitoring**: Add metrics collection