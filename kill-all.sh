#!/bin/bash

# Kill script for Porto zkEmail demo

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${RED}🛑 Stopping Porto zkEmail Demo Environment${NC}"
echo ""

# Kill tmux session
echo -e "${YELLOW}Killing tmux session 'porto'...${NC}"
tmux kill-session -t porto 2>/dev/null && echo -e "${GREEN}✓ Tmux session killed${NC}" || echo -e "${YELLOW}No tmux session found${NC}"

# Kill processes on specific ports
echo -e "${YELLOW}Killing processes on ports...${NC}"

# Kill Anvil (port 8545)
if lsof -Pi :8545 -sTCP:LISTEN -t >/dev/null 2>&1; then
    lsof -ti:8545 | xargs kill -9 2>/dev/null
    echo -e "${GREEN}✓ Killed process on port 8545 (Anvil)${NC}"
else
    echo -e "${YELLOW}No process found on port 8545${NC}"
fi

# Kill Web app (port 3000)
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    echo -e "${GREEN}✓ Killed process on port 3000 (Web)${NC}"
else
    echo -e "${YELLOW}No process found on port 3000${NC}"
fi

# Kill Email service (port 3001)
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    lsof -ti:3001 | xargs kill -9 2>/dev/null
    echo -e "${GREEN}✓ Killed process on port 3001 (Email)${NC}"
else
    echo -e "${YELLOW}No process found on port 3001${NC}"
fi

# Kill M1 Prover service (port 3003)
if lsof -Pi :3003 -sTCP:LISTEN -t >/dev/null 2>&1; then
    lsof -ti:3003 | xargs kill -9 2>/dev/null
    echo -e "${GREEN}✓ Killed process on port 3003 (Prover)${NC}"
else
    echo -e "${YELLOW}No process found on port 3003${NC}"
fi

# Kill any node processes that might be hanging
echo -e "${YELLOW}Cleaning up Node.js processes...${NC}"
pkill -f "node.*dev" 2>/dev/null && echo -e "${GREEN}✓ Killed Node.js dev processes${NC}" || echo -e "${YELLOW}No Node.js processes found${NC}"

# Clean up deployment info
if [ -f "deployment-info.json" ]; then
    rm deployment-info.json
    echo -e "${GREEN}✓ Removed deployment info${NC}"
fi

echo ""
echo -e "${GREEN}✅ All services stopped!${NC}"
echo ""
echo -e "${YELLOW}To restart, run: ./start-all.sh${NC}"