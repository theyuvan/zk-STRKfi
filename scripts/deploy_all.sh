#!/bin/bash

# Deploy All Contracts Script
# Usage: ./deploy_all.sh [starknet|evm|all]

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

DEPLOY_TARGET=${1:-all}

echo -e "${YELLOW}ZK Affordability Loan - Contract Deployment${NC}"
echo ""

# Check if .env exists
if [ ! -f "../backend/.env" ]; then
    echo -e "${RED}Error: .env file not found in backend directory${NC}"
    echo "Please copy .env.example to .env and configure it"
    exit 1
fi

# Load environment variables
source ../backend/.env

deploy_starknet() {
    echo -e "${YELLOW}Deploying StarkNet contracts...${NC}"
    
    if [ -z "$STARKNET_RPC" ]; then
        echo -e "${RED}Error: STARKNET_RPC not set in .env${NC}"
        exit 1
    fi
    
    cd "$(dirname "$0")/../contracts"
    
    # Compile contracts first
    echo "Compiling StarkNet contracts..."
    npm run compile:starknet
    
    # Deploy using Node.js script
    echo "Deploying contracts..."
    node deploy/deploy_starknet.js
    
    echo -e "${GREEN}✓ StarkNet contracts deployed${NC}"
}

deploy_evm() {
    echo -e "${YELLOW}Deploying EVM contracts...${NC}"
    
    if [ -z "$EVM_RPC" ]; then
        echo -e "${RED}Error: EVM_RPC not set in .env${NC}"
        exit 1
    fi
    
    cd "$(dirname "$0")/../contracts"
    
    # Compile contracts
    echo "Compiling Solidity contracts..."
    npm run compile:solidity
    
    # Deploy
    echo "Deploying contracts..."
    npx hardhat run deploy/deploy_evm.js --network goerli
    
    echo -e "${GREEN}✓ EVM contracts deployed${NC}"
}

case $DEPLOY_TARGET in
    starknet)
        deploy_starknet
        ;;
    evm)
        deploy_evm
        ;;
    all)
        deploy_starknet
        echo ""
        deploy_evm
        ;;
    *)
        echo -e "${RED}Invalid target: $DEPLOY_TARGET${NC}"
        echo "Usage: ./deploy_all.sh [starknet|evm|all]"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✓ Deployment completed!${NC}"
echo ""
echo "Update your .env file with the deployed contract addresses"
