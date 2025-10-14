#!/bin/bash

# Automated Test Transaction Script for Starknet Sepolia
# Makes multiple small ETH transfers to increase wallet activity score

# Configuration
RPC_URL="https://starknet-sepolia.infura.io/v3/8b1888ab10334c00900e962e9e3d49b2"
KEYSTORE_PATH="$HOME/.starkli-wallets/deployer/keystore.json"
ACCOUNT_PATH="$HOME/.starkli-wallets/deployer/account.json"
RECIPIENT="0x05B3cf7557800CcE10fbAD48E6cc95F2Ffd82702996eA324bBB2470B6A6Ba7ef"  # Your address
ETH_TOKEN="0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7"

# Amount per transaction (0.000001 ETH in wei)
AMOUNT="1000000000000"

# Number of transactions to make
NUM_TRANSACTIONS=${1:-50}

echo "=================================================="
echo "  STARKNET TEST TRANSACTION GENERATOR"
echo "=================================================="
echo ""
echo "📝 Configuration:"
echo "   Transactions: $NUM_TRANSACTIONS"
echo "   Amount per tx: 0.000001 ETH"
echo "   Recipient: $RECIPIENT"
echo ""

# Check if starkli is installed
if ! command -v ~/.starkli/bin/starkli &> /dev/null; then
    echo "❌ Error: starkli not found at ~/.starkli/bin/starkli"
    exit 1
fi

# Check if keystore exists
if [ ! -f "$KEYSTORE_PATH" ]; then
    echo "❌ Error: Keystore not found at $KEYSTORE_PATH"
    echo "💡 Expected path: ~/.starkli-wallets/deployer/keystore.json"
    exit 1
fi

# Check if account exists
if [ ! -f "$ACCOUNT_PATH" ]; then
    echo "❌ Error: Account file not found at $ACCOUNT_PATH"
    echo "💡 Expected path: ~/.starkli-wallets/deployer/account.json"
    exit 1
fi

# Get initial nonce
echo "🔍 Checking initial state..."
INITIAL_NONCE=$(~/.starkli/bin/starkli nonce "$RECIPIENT" --rpc "$RPC_URL")
echo "🔢 Current nonce: $INITIAL_NONCE"

# Get initial balance
INITIAL_BALANCE=$(~/.starkli/bin/starkli balance "$RECIPIENT" --rpc "$RPC_URL")
echo "💵 Current balance: $INITIAL_BALANCE ETH"
echo ""

# Make transactions
echo "🔄 Starting transactions..."
echo ""

SUCCESSFUL=0
FAILED=0

for ((i=1; i<=NUM_TRANSACTIONS; i++)); do
    echo -n "📤 [$i/$NUM_TRANSACTIONS] Sending transaction... "
    
    # Invoke transfer function
    # Note: This will prompt for password each time unless you export STARKNET_KEYSTORE_PASSWORD
    RESULT=$(~/.starkli/bin/starkli invoke \
        --rpc "$RPC_URL" \
        --account "$ACCOUNT_PATH" \
        --keystore "$KEYSTORE_PATH" \
        "$ETH_TOKEN" \
        transfer \
        "$RECIPIENT" \
        "u256:$AMOUNT" \
        2>&1)
    
    if [ $? -eq 0 ]; then
        # Extract transaction hash
        TX_HASH=$(echo "$RESULT" | grep -o "0x[0-9a-f]*" | head -1)
        echo "✅ Success! (tx: $TX_HASH)"
        ((SUCCESSFUL++))
    else
        echo "❌ Failed"
        ((FAILED++))
        
        # Check if it's a rate limit error
        if echo "$RESULT" | grep -q "rate"; then
            echo "⏳ Rate limited, waiting 10 seconds..."
            sleep 10
        fi
    fi
    
    # Small delay between transactions
    if [ $i -lt $NUM_TRANSACTIONS ]; then
        sleep 3
    fi
done

echo ""
echo "============================================"
echo "📊 TRANSACTION SUMMARY"
echo "============================================"
echo "✅ Successful: $SUCCESSFUL/$NUM_TRANSACTIONS"
echo "❌ Failed: $FAILED/$NUM_TRANSACTIONS"

# Check final nonce
FINAL_NONCE=$(~/.starkli/bin/starkli nonce "$RECIPIENT" --rpc "$RPC_URL")
NONCE_INCREASE=$((FINAL_NONCE - INITIAL_NONCE))
echo "🔢 Final nonce: $FINAL_NONCE (increased by $NONCE_INCREASE)"

# Calculate estimated activity score
BALANCE_WEI=$(echo "$INITIAL_BALANCE * 1000000000000000000" | bc | cut -d. -f1)
BALANCE_SCORE=$(echo "scale=0; ($INITIAL_BALANCE * 100)" | bc)
if [ $(echo "$BALANCE_SCORE > 400" | bc) -eq 1 ]; then
    BALANCE_SCORE=400
fi

TX_SCORE=$((FINAL_NONCE * 5))
if [ $TX_SCORE -gt 400 ]; then
    TX_SCORE=400
fi

if [ $FINAL_NONCE -gt 10 ]; then
    CONSISTENCY_SCORE=200
elif [ $FINAL_NONCE -gt 5 ]; then
    CONSISTENCY_SCORE=100
else
    CONSISTENCY_SCORE=50
fi

TOTAL_SCORE=$((BALANCE_SCORE + TX_SCORE + CONSISTENCY_SCORE))

echo ""
echo "🎯 ESTIMATED NEW ACTIVITY SCORE:"
echo "   Balance Score: $BALANCE_SCORE"
echo "   Transaction Score: $TX_SCORE"
echo "   Consistency Score: $CONSISTENCY_SCORE"
echo "   TOTAL: $TOTAL_SCORE / 500"

if [ $TOTAL_SCORE -ge 500 ]; then
    echo ""
    echo "🎉 CONGRATULATIONS! You now meet the threshold!"
else
    NEEDED=$((500 - TOTAL_SCORE))
    echo ""
    echo "⚠️  Need $NEEDED more points"
    echo "   Suggestions:"
    
    if [ $TX_SCORE -lt 400 ]; then
        NEEDED_TX=$(( (NEEDED / 5) + 1 ))
        echo "   - Make $NEEDED_TX more transactions"
    fi
    
    if [ $BALANCE_SCORE -lt 400 ]; then
        NEEDED_ETH=$(echo "scale=2; $NEEDED / 100" | bc)
        echo "   - Add $NEEDED_ETH ETH to your balance"
    fi
fi

echo ""
echo "✅ Done!"
