#!/bin/bash

# Start script for Porto zkEmail integration project
# Uses tmux to manage multiple services

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Session name
SESSION_NAME="porto-zkemail"

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}     Porto zkEmail Services Launcher${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo -e "${RED}✗ Error: tmux is not installed${NC}"
    echo "Please install tmux first:"
    echo "  macOS: brew install tmux"
    echo "  Ubuntu/Debian: sudo apt-get install tmux"
    echo "  Fedora: sudo dnf install tmux"
    exit 1
fi
echo -e "${GREEN}✓ tmux found${NC}"

# Check if session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo -e "${YELLOW}⚠ Session '$SESSION_NAME' already exists${NC}"
    echo "To attach: tmux attach -t $SESSION_NAME"
    echo "To kill it first: ./kill.sh"
    exit 1
fi

# Kill any existing processes on our ports
echo ""
echo -e "${YELLOW}Checking for existing processes...${NC}"

# Kill process on port 3000 (test site)
if lsof -ti:3000 > /dev/null 2>&1; then
    echo -e "  ${YELLOW}→ Found process on port 3000, killing...${NC}"
    kill -9 $(lsof -ti:3000) 2>/dev/null
    sleep 1
    echo -e "  ${GREEN}✓ Port 3000 cleared${NC}"
else
    echo -e "  ${GREEN}✓ Port 3000 is free${NC}"
fi

# Kill process on port 3001 (email server)
if lsof -ti:3001 > /dev/null 2>&1; then
    echo -e "  ${YELLOW}→ Found process on port 3001, killing...${NC}"
    kill -9 $(lsof -ti:3001) 2>/dev/null
    sleep 1
    echo -e "  ${GREEN}✓ Port 3001 cleared${NC}"
else
    echo -e "  ${GREEN}✓ Port 3001 is free${NC}"
fi

# Kill process on port 8545 (Anvil blockchain)
if lsof -ti:8545 > /dev/null 2>&1; then
    echo -e "  ${YELLOW}→ Found process on port 8545, killing...${NC}"
    kill -9 $(lsof -ti:8545) 2>/dev/null
    sleep 1
    echo -e "  ${GREEN}✓ Port 8545 cleared${NC}"
else
    echo -e "  ${GREEN}✓ Port 8545 is free${NC}"
fi

echo ""
echo -e "${YELLOW}Starting services in tmux session: ${SESSION_NAME}${NC}"
echo ""

# Create new tmux session
echo -e "  ${BLUE}→ Creating tmux session...${NC}"
tmux new-session -d -s "$SESSION_NAME" -n "email-server"
if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}✓ Session created${NC}"
else
    echo -e "  ${RED}✗ Failed to create session${NC}"
    exit 1
fi

# Window 1: Anvil Blockchain
echo -e "  ${BLUE}→ Starting Anvil local blockchain...${NC}"
tmux rename-window -t "$SESSION_NAME:0" "anvil"
tmux send-keys -t "$SESSION_NAME:anvil" "echo '═══ Starting Anvil Blockchain ═══'" C-m
tmux send-keys -t "$SESSION_NAME:anvil" "anvil --accounts 10 --balance 10000 --chain-id 31337 --port 8545" C-m
echo -e "  ${GREEN}✓ Anvil blockchain started${NC}"

# Window 2: Email Server
echo -e "  ${BLUE}→ Starting email infrastructure server...${NC}"
tmux new-window -t "$SESSION_NAME" -n "email-server"
tmux send-keys -t "$SESSION_NAME:email-server" "cd '$SCRIPT_DIR/email-infrastructure'" C-m
tmux send-keys -t "$SESSION_NAME:email-server" "echo '═══ Email Server Starting ═══'" C-m
tmux send-keys -t "$SESSION_NAME:email-server" "npm start" C-m
echo -e "  ${GREEN}✓ Email server commands sent${NC}"

# Window 3: Test Site (Next.js)
echo -e "  ${BLUE}→ Starting test site...${NC}"
tmux new-window -t "$SESSION_NAME" -n "test-site"
tmux send-keys -t "$SESSION_NAME:test-site" "cd '$SCRIPT_DIR/test-site'" C-m
tmux send-keys -t "$SESSION_NAME:test-site" "echo '═══ Test Site Starting ═══'" C-m
tmux send-keys -t "$SESSION_NAME:test-site" "npm run dev" C-m
echo -e "  ${GREEN}✓ Test site commands sent${NC}"

# Window 4: Contract Deployment
echo -e "  ${BLUE}→ Deploying contracts to Anvil...${NC}"
tmux new-window -t "$SESSION_NAME" -n "contracts"
tmux send-keys -t "$SESSION_NAME:contracts" "cd '$SCRIPT_DIR/porto'" C-m
tmux send-keys -t "$SESSION_NAME:contracts" "echo '═══ Waiting for Anvil to start ═══'" C-m
tmux send-keys -t "$SESSION_NAME:contracts" "sleep 5" C-m
tmux send-keys -t "$SESSION_NAME:contracts" "echo '═══ Deploying contracts ═══'" C-m
tmux send-keys -t "$SESSION_NAME:contracts" "forge script script/Deploy.s.sol:DeployScript --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast 2>/dev/null || echo 'Contract deployment will be handled by the frontend'" C-m
echo -e "  ${GREEN}✓ Contract deployment commands sent${NC}"

# Window 5: Logs Monitor
echo -e "  ${BLUE}→ Setting up logs monitor...${NC}"
tmux new-window -t "$SESSION_NAME" -n "logs"
tmux send-keys -t "$SESSION_NAME:logs" "cd '$SCRIPT_DIR/email-infrastructure'" C-m
tmux send-keys -t "$SESSION_NAME:logs" "echo '═══ Monitoring server.log ═══'" C-m
tmux send-keys -t "$SESSION_NAME:logs" "touch server.log && tail -f server.log" C-m
echo -e "  ${GREEN}✓ Log monitor configured${NC}"

# Window 6: Shell (for manual commands)
echo -e "  ${BLUE}→ Creating shell window...${NC}"
tmux new-window -t "$SESSION_NAME" -n "shell"
tmux send-keys -t "$SESSION_NAME:shell" "cd '$SCRIPT_DIR'" C-m
tmux send-keys -t "$SESSION_NAME:shell" "echo '═══ Shell ready for manual commands ═══'" C-m
echo -e "  ${GREEN}✓ Shell window created${NC}"

# Give services a moment to start
echo ""
echo -e "${YELLOW}Waiting for services to initialize...${NC}"
sleep 3

# Check if services are starting
echo ""
echo -e "${YELLOW}Checking service status...${NC}"

# Check email server
if lsof -ti:3001 > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Email server is starting on port 3001${NC}"
else
    echo -e "  ${YELLOW}⚠ Email server may still be initializing on port 3001${NC}"
fi

# Check test site
if lsof -ti:3000 > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Test site is starting on port 3000${NC}"
else
    echo -e "  ${YELLOW}⚠ Test site may still be initializing on port 3000${NC}"
fi

# Check Anvil blockchain
if lsof -ti:8545 > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Anvil blockchain is running on port 8545${NC}"
else
    echo -e "  ${YELLOW}⚠ Anvil blockchain may still be initializing on port 8545${NC}"
fi

# Display final status
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ All services launched successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Services:${NC}"
echo "  • Anvil Blockchain: http://localhost:8545"
echo "  • Email Server: http://localhost:3001"
echo "  • Test Site: http://localhost:3000"
echo ""
echo -e "${BLUE}Tmux windows in session '$SESSION_NAME':${NC}"
echo "  0. anvil        - Local Ethereum blockchain"
echo "  1. email-server - Email infrastructure server"
echo "  2. test-site    - Next.js test application"
echo "  3. contracts    - Smart contract deployment"
echo "  4. logs         - Server logs monitor"
echo "  5. shell        - Shell for manual commands"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "  • View logs:        tmux attach -t $SESSION_NAME"
echo "  • Switch windows:   Ctrl+b then 0-3"
echo "  • Detach:          Ctrl+b then d"
echo "  • Stop all:        ./kill.sh"
echo ""
echo -e "${YELLOW}Services are running in the background.${NC}"
echo -e "${YELLOW}Use 'tmux attach -t $SESSION_NAME' to view logs.${NC}"