# Porto zkEmail Demo

A demonstration of Porto's zkEmail integration for smart account creation and management without seed phrases or MetaMask.

## Quick Start

```bash
# Start everything
./start.sh

# Or use tmux for background management
./start.sh --tmux

# Stop everything
./kill-all.sh
```

## What This Demo Shows

Porto creates smart accounts using:
- **Email verification** via zkEmail proofs
- **Passkeys** for transaction signing (no private keys!)
- **EIP-7702** for EOA → smart account conversion
- **Gas sponsorship** via ERC-4337 Orchestrator
- **No MetaMask needed** - generates ephemeral wallets

## Project Structure

```
porto-zk/
├── porto/                    # Porto smart contracts
│   └── contracts/accountV2/  # V2 contracts with zkEmail
├── email-infrastructure/     # Email service & proof generation
├── test-site/               # Next.js demo website
├── start.sh                 # Start everything (ONE script!)
├── kill-all.sh              # Stop everything
└── GMAIL-SETUP-GUIDE.md     # Gmail configuration instructions
```

## Setup Requirements

1. **Node.js 18+** and **npm**
2. **Foundry** for smart contracts
3. **Gmail account** with app password (see GMAIL-SETUP-GUIDE.md)

## How It Works

1. User enters email address
2. System generates ephemeral EOA
3. Sends verification email
4. User replies to verify
5. User creates passkey (biometric)
6. Deploys EIP-7702 proxy (gas sponsored)
7. Throws away private key
8. All future signing via passkey!

## Documentation

- `GMAIL-SETUP-GUIDE.md` - Gmail setup instructions
- `ARCHITECTURE.md` - Complete system architecture
- `ZKEMAIL-INTEGRATION.md` - zkEmail technical details

## Demo Notes

- Email proofs are mocked (3-5s vs 20-30s production)
- Passkey creation is simulated
- Gas sponsorship uses funded test account
- Real zkEmail circuits ready but not active

## Services

When running, you'll have:
- **Blockchain**: http://localhost:8545 (Anvil)
- **Email API**: http://localhost:3001
- **Web App**: http://localhost:3000

## Troubleshooting

If services don't start:
1. Check logs: `anvil.log`, `email.log`, `web.log`
2. Ensure ports 8545, 3000, 3001 are free
3. Run `./kill-all.sh` then `./start.sh` again