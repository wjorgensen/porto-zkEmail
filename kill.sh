#!/bin/bash

# Kill script for Porto zkEmail integration project
# Stops all services and cleans up tmux session

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Session name
SESSION_NAME="porto-zkemail"

echo -e "${YELLOW}Stopping Porto zkEmail services...${NC}"

# Check if tmux session exists
if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo -e "${YELLOW}Session '$SESSION_NAME' not found${NC}"
    echo "Services may not be running."
    
    # Still try to kill processes by port
    echo "Checking for processes on known ports..."
    
    # Kill process on port 3000 (test site)
    if lsof -ti:3000 > /dev/null 2>&1; then
        echo "Killing process on port 3000..."
        kill -9 $(lsof -ti:3000) 2>/dev/null
    fi
    
    # Kill process on port 3001 (email server)
    if lsof -ti:3001 > /dev/null 2>&1; then
        echo "Killing process on port 3001..."
        kill -9 $(lsof -ti:3001) 2>/dev/null
    fi
    
    # Kill process on port 8545 (Anvil blockchain)
    if lsof -ti:8545 > /dev/null 2>&1; then
        echo "Killing process on port 8545..."
        kill -9 $(lsof -ti:8545) 2>/dev/null
    fi
    
    echo -e "${GREEN}✓ Cleanup complete${NC}"
    exit 0
fi

# Kill the tmux session
echo "Killing tmux session: $SESSION_NAME"
tmux kill-session -t "$SESSION_NAME"

# Additional cleanup - kill any remaining processes on known ports
echo "Cleaning up any remaining processes..."

# Kill process on port 3000 (test site)
if lsof -ti:3000 > /dev/null 2>&1; then
    echo "Killing remaining process on port 3000..."
    kill -9 $(lsof -ti:3000) 2>/dev/null
fi

# Kill process on port 3001 (email server)
if lsof -ti:3001 > /dev/null 2>&1; then
    echo "Killing remaining process on port 3001..."
    kill -9 $(lsof -ti:3001) 2>/dev/null
fi

# Kill process on port 8545 (Anvil blockchain)
if lsof -ti:8545 > /dev/null 2>&1; then
    echo "Killing remaining process on port 8545..."
    kill -9 $(lsof -ti:8545) 2>/dev/null
fi

echo -e "${GREEN}✓ All services stopped successfully!${NC}"
echo ""
echo "Cleaned up:"
echo "  • Tmux session: $SESSION_NAME"
echo "  • Email server (port 3001)"
echo "  • Test site (port 3000)"
echo "  • Anvil blockchain (port 8545)"
echo ""
echo "To start services again, run: ./start.sh"