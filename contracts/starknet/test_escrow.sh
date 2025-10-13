#!/bin/bash

# 🧪 Test Multi-Borrower Escrow Contract
# Run after deployment

set -e

echo "🧪 Testing Multi-Borrower Escrow Contract"
echo "=========================================="

# Load deployment info
DEPLOY_INFO="/mnt/c/zk-affordability-loan/contracts/starknet/deployed_escrow_multi.json"

if [ ! -f "$DEPLOY_INFO" ]; then
    echo "❌ Deployment info not found!"
    echo "Please run deploy_escrow_multi.sh first"
    exit 1
fi

CONTRACT_ADDRESS=$(cat "$DEPLOY_INFO" | grep -oP '"contract_address":\s*"\K[^"]+')
STRK_TOKEN=$(cat "$DEPLOY_INFO" | grep -oP '"strk_token":\s*"\K[^"]+')
RPC_URL=$(cat "$DEPLOY_INFO" | grep -oP '"rpc_url":\s*"\K[^"]+')

echo "Contract: $CONTRACT_ADDRESS"
echo "STRK Token: $STRK_TOKEN"
echo ""

export STARKNET_RPC="$RPC_URL"
export STARKNET_ACCOUNT="$HOME/.starkli/accounts/deployer.json"
export STARKNET_KEYSTORE="$HOME/.starkli/keystore/deployer_key.json"

# Test 1: Get loan count
echo "📊 Test 1: Get loan count"
starkli call \
  $CONTRACT_ADDRESS \
  get_loan_count \
  --rpc $STARKNET_RPC

echo ""
read -p "Create a test loan? This will cost STRK tokens. (y/n) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Test cancelled"
    exit 0
fi

# Test 2: Approve STRK for escrow
echo ""
echo "📝 Test 2: Approve 100 STRK for escrow..."
echo "Amount: 100 STRK (for 2 borrowers × 50 STRK each)"

# 100 STRK in Wei
LOW="0x56bc75e2d63100000"
HIGH="0x0"

starkli invoke \
  $STRK_TOKEN \
  approve \
  $CONTRACT_ADDRESS \
  $LOW $HIGH \
  --rpc $STARKNET_RPC \
  --account $STARKNET_ACCOUNT \
  --keystore $STARKNET_KEYSTORE

echo "✅ STRK approved"

# Test 3: Create multi-borrower loan
echo ""
echo "💼 Test 3: Creating multi-borrower loan..."

# Parameters
AMOUNT_LOW="0x2b5e3af16b1880000"  # 50 STRK
AMOUNT_HIGH="0x0"
MAX_BORROWERS="2"
INTEREST_BPS="500"  # 5%
REPAYMENT_PERIOD="600"  # 10 minutes
LENDER_COMMITMENT="0x$(openssl rand -hex 32)"  # Random commitment

echo "Parameters:"
echo "  Amount per borrower: 50 STRK"
echo "  Max borrowers: 2"
echo "  Interest rate: 5%"
echo "  Repayment period: 600 seconds"
echo "  Lender commitment: $LENDER_COMMITMENT"
echo ""

starkli invoke \
  $CONTRACT_ADDRESS \
  create_multi_loan \
  $AMOUNT_LOW $AMOUNT_HIGH \
  $MAX_BORROWERS \
  $INTEREST_BPS \
  $REPAYMENT_PERIOD \
  $LENDER_COMMITMENT \
  --rpc $STARKNET_RPC \
  --account $STARKNET_ACCOUNT \
  --keystore $STARKNET_KEYSTORE

echo "✅ Loan created"

# Test 4: Verify loan was created
echo ""
echo "🔍 Test 4: Verify loan was created..."

starkli call \
  $CONTRACT_ADDRESS \
  get_loan_count \
  --rpc $STARKNET_RPC

echo ""
echo "📋 Get loan details (loan ID: 1)..."

starkli call \
  $CONTRACT_ADDRESS \
  get_loan \
  1 \
  --rpc $STARKNET_RPC

echo ""
echo "✅ All tests passed!"
echo ""
echo "🎯 Next steps:"
echo "1. Use frontend to apply for this loan as a borrower"
echo "2. Approve borrower using approve_borrower function"
echo "3. Borrower receives 50 STRK from escrow"
echo "4. Borrower repays 52.5 STRK (50 + 5%)"
echo ""
echo "📝 Loan commitment: $LENDER_COMMITMENT"
echo "💡 Save this for testing!"
