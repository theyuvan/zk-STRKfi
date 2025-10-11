#!/bin/bash

# Build ZK Circuits Script
# This script compiles the Circom circuits and generates proving/verification keys

set -e

echo "Building ZK Circuits for Income Verification..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Navigate to ZK directory
cd "$(dirname "$0")/../contracts/zk"

# Create build directory
mkdir -p build
cd build

echo -e "${YELLOW}Step 1: Compiling circuit...${NC}"
circom ../incomeVerifier.circom --r1cs --wasm --sym -o .

echo -e "${YELLOW}Step 2: Generating witness calculator...${NC}"
# Witness calculator is generated automatically with --wasm flag

echo -e "${YELLOW}Step 3: Powers of Tau ceremony...${NC}"
if [ ! -f "pot12_final.ptau" ]; then
    echo "Generating Powers of Tau (this may take a while)..."
    snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
    snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v -e="random entropy"
    snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v
    echo -e "${GREEN}Powers of Tau completed${NC}"
else
    echo -e "${GREEN}Using existing Powers of Tau file${NC}"
fi

echo -e "${YELLOW}Step 4: Generating zkey...${NC}"
snarkjs groth16 setup incomeVerifier.r1cs pot12_final.ptau incomeVerifier_0000.zkey
snarkjs zkey contribute incomeVerifier_0000.zkey incomeVerifier.zkey --name="Contribution" -v -e="more random entropy"

echo -e "${YELLOW}Step 5: Exporting verification key...${NC}"
snarkjs zkey export verificationkey incomeVerifier.zkey verification_key.json

echo -e "${YELLOW}Step 6: Exporting Solidity verifier (optional)...${NC}"
snarkjs zkey export solidityverifier incomeVerifier.zkey verifier.sol

echo -e "${GREEN}✓ Circuit build completed successfully!${NC}"
echo ""
echo "Generated files:"
echo "  - incomeVerifier.r1cs"
echo "  - incomeVerifier.wasm (in incomeVerifier_js/)"
echo "  - incomeVerifier.zkey"
echo "  - verification_key.json"
echo "  - verifier.sol"
echo ""
echo "To generate a proof, use:"
echo "  snarkjs groth16 prove incomeVerifier.zkey witness.wtns proof.json public.json"
echo ""
echo "To verify a proof, use:"
echo "  snarkjs groth16 verify verification_key.json public.json proof.json"
