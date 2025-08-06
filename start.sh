#!/bin/bash

# Porto zkEmail Demo - Unified Startup Script
# This is the ONLY startup script you need!

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting Porto zkEmail Demo${NC}"
echo ""

# Parse arguments
USE_TMUX=false
if [[ "$1" == "--tmux" ]]; then
    USE_TMUX=true
    echo -e "${GREEN}Using tmux for background services${NC}"
fi

# Kill any existing processes
echo -e "${YELLOW}Cleaning up existing processes...${NC}"
./kill-all.sh > /dev/null 2>&1 || true
sleep 2

# Start Anvil
echo -e "${BLUE}Starting Anvil blockchain...${NC}"
if [ "$USE_TMUX" = true ]; then
    tmux new-session -d -s porto -n anvil
    tmux send-keys -t porto:anvil "anvil --accounts 10 --balance 10000 --port 8545" C-m
else
    nohup anvil --accounts 10 --balance 10000 --port 8545 > anvil.log 2>&1 &
    ANVIL_PID=$!
    echo "Anvil PID: $ANVIL_PID"
fi
sleep 5

# Check if Anvil is running
if ! lsof -i :8545 > /dev/null; then
    echo -e "${RED}Anvil failed to start. Check anvil.log${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Anvil started successfully${NC}"

# Deploy contracts (or use existing)
echo -e "${BLUE}Setting up contracts...${NC}"
cd porto/contracts/accountV2

# Use hardcoded addresses for speed (they're deterministic on Anvil)
FACTORY_ADDR="0x5FbDB2315678afecb367f032d93F642f64180aa3"
ORCHESTRATOR_ADDR="0x818C9339ABC63C46Fe06B0CE2DE5c0b20f23923E"
ZKEMAIL_VERIFIER_ADDR="0x83480CaAb6E6FE4Eff480fc0ee17379EED25572a"
ACCOUNT_IMPL_ADDR="0x564F8b8957Bf03Cd02Cf055dB3B9F9f30dC6037E"
ACCOUNT_PROXY_ADDR="0xF5a71C6794A476a26C42Af3a08a3a86352312c95"
SIMULATOR_ADDR="0xe57A682645C908c104dE589C805C99a7bB5E6DD0"
TEST_TOKEN_ADDR="0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"

# Check if contracts exist, deploy if not
if ! cast code $FACTORY_ADDR --rpc-url http://localhost:8545 2>/dev/null | grep -q "0x"; then
    echo "Deploying contracts..."
    PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
    forge script script/DeployAll.s.sol --rpc-url http://localhost:8545 --broadcast > /dev/null 2>&1
fi

cd ../../..

# Update configurations
echo -e "${BLUE}Updating configurations...${NC}"

# Update test-site contracts
cat > test-site/src/lib/contracts.ts << EOF
// Contract addresses from deployment
export const CONTRACTS = {
  factory: "$FACTORY_ADDR",
  orchestrator: "$ORCHESTRATOR_ADDR",
  zkEmailVerifier: "$ZKEMAIL_VERIFIER_ADDR",
  accountImplementation: "$ACCOUNT_IMPL_ADDR",
  accountProxy: "$ACCOUNT_PROXY_ADDR",
  simulator: "$SIMULATOR_ADDR",
  testToken: "$TEST_TOKEN_ADDR"
} as const;

// Chain configuration
export const ANVIL_CHAIN = {
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://localhost:8545'] },
    public: { http: ['http://localhost:8545'] }
  },
  blockExplorers: {
    default: { name: 'Anvil', url: 'http://localhost:8545' }
  }
} as const;
EOF

# Update email infrastructure .env
if [ -f "email-infrastructure/.env" ]; then
    sed -i.bak "s/^ACCOUNT_IMPLEMENTATION=.*/ACCOUNT_IMPLEMENTATION=$ACCOUNT_IMPL_ADDR/" email-infrastructure/.env
    sed -i.bak "s/^ZK_EMAIL_VERIFIER=.*/ZK_EMAIL_VERIFIER=$ZKEMAIL_VERIFIER_ADDR/" email-infrastructure/.env
    sed -i.bak "s/^ORCHESTRATOR=.*/ORCHESTRATOR=$ORCHESTRATOR_ADDR/" email-infrastructure/.env
fi

# Start email service
echo -e "${BLUE}Starting email service...${NC}"
cd email-infrastructure
if [ ! -d "node_modules" ]; then
    echo "Installing email service dependencies..."
    npm install > /dev/null 2>&1
fi

if [ "$USE_TMUX" = true ]; then
    tmux new-window -t porto -n email
    tmux send-keys -t porto:email "cd $(pwd) && npm start" C-m
else
    nohup npm start > ../email.log 2>&1 &
    EMAIL_PID=$!
    echo "Email service PID: $EMAIL_PID"
fi
cd ..

# Start web app
echo -e "${BLUE}Starting web application...${NC}"
cd test-site
if [ ! -d "node_modules" ]; then
    echo "Installing web app dependencies..."
    npm install > /dev/null 2>&1
fi

if [ "$USE_TMUX" = true ]; then
    tmux new-window -t porto -n web
    tmux send-keys -t porto:web "cd $(pwd) && npm run dev" C-m
else
    nohup npm run dev > ../web.log 2>&1 &
    WEB_PID=$!
    echo "Web app PID: $WEB_PID"
fi
cd ..

# Display status
echo ""
echo -e "${GREEN}✅ Porto zkEmail Demo is running!${NC}"
echo ""
echo -e "${BLUE}Services:${NC}"
echo "  🔗 Blockchain:     http://localhost:8545"
echo "  📧 Email Service:  http://localhost:3001"
echo "  🌐 Web App:        http://localhost:3000"
echo ""

if [ "$USE_TMUX" = true ]; then
    echo -e "${BLUE}Tmux Commands:${NC}"
    echo "  View sessions:     tmux attach -t porto"
    echo "  Switch windows:    Ctrl+b then 0/1/2"
    echo "  Detach:           Ctrl+b then d"
else
    echo -e "${BLUE}Logs:${NC}"
    echo "  Anvil:        ./anvil.log"
    echo "  Email:        ./email.log"
    echo "  Web:          ./web.log"
fi

echo ""
echo -e "${YELLOW}To stop all services:${NC} ./kill-all.sh"
echo ""
echo -e "${GREEN}🎉 Open http://localhost:3000 to get started!${NC}"
echo ""
echo -e "${BLUE}Gmail Setup Required:${NC}"
echo "  Edit email-infrastructure/.env"
echo "  Add your Gmail app password"
echo "  See GMAIL-SETUP-GUIDE.md for instructions"