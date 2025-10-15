# StarkNet Wallet Integration

## Overview
The Borrowers page now uses **real StarkNet wallet connection** via `get-starknet-core` library.

## Supported Wallets
- **Ready Wallet** (formerly Argent X) - StarkNet wallet browser extension
- **Braavos** - StarkNet wallet browser extension

## How It Works

### 1. Wallet Connection Flow
```typescript
// User clicks "Connect Wallet"
handleConnectWallet() 
  → connectWallet() from @/lib/wallet
  → get-starknet-core shows modal
  → User selects wallet (Argent/Braavos)
  → Wallet address is returned
  → Auto-triggers wallet analysis
```

### 2. Implementation Details

**File: `/app/borrowers/page.tsx`**
```typescript
import { connectWallet } from '@/lib/wallet'

const handleConnectWallet = async () => {
  setIsConnecting(true)
  try {
    const wallet = await connectWallet()
    if (wallet.address) {
      setWalletAddress(wallet.address)
      analyzeWallet()
    }
  } catch (error) {
    console.error('Failed to connect wallet:', error)
    alert('Failed to connect wallet. Please install Argent or Braavos.')
  } finally {
    setIsConnecting(false)
  }
}
```

**File: `/lib/wallet.ts`**
- Uses `get-starknet-core` for wallet connection
- Supports both Argent X and Braavos wallets
- Returns wallet address and account interface
- Handles connection errors gracefully

### 3. User Experience

1. **Before Connection:**
   - Shows "Connect Wallet" button
   - Displays instructions about supported wallets

2. **During Connection:**
   - Button shows "Connecting..." state
   - Modal appears with wallet options
   - User selects preferred wallet

3. **After Connection:**
   - Displays connected wallet address
   - Automatically analyzes wallet eligibility
   - Shows eligibility score and criteria

### 4. Error Handling

- **No Wallet Installed:** Alert prompts user to install Argent or Braavos
- **Connection Rejected:** User can retry connection
- **Network Issues:** Error logged to console with user-friendly message

## Testing

### Prerequisites
1. Install a StarkNet wallet:
   - [Ready Wallet](https://www.argent.xyz/) (formerly Argent X)
   - [Braavos](https://braavos.app/)

2. Have some test ETH on StarkNet testnet (optional for testing)

### Test Steps
1. Navigate to `/borrowers` page
2. Click "Connect Wallet" button
3. Select your wallet from the modal
4. Approve connection in wallet extension
5. Verify wallet address is displayed
6. Check that eligibility analysis runs automatically

## Next Steps for Backend Integration

Replace the mock `analyzeWallet()` function with actual API call:

```typescript
const analyzeWallet = async () => {
  setIsAnalyzing(true)
  try {
    const response = await fetch('/api/analyze-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: walletAddress })
    })
    const data = await response.json()
    setAnalysis(data)
  } catch (error) {
    console.error('Analysis failed:', error)
  } finally {
    setIsAnalyzing(false)
  }
}
```

## Dependencies

```json
{
  "get-starknet-core": "^4.0.0",
  "starknet": "^6.11.0"
}
```

## Notes

- The wallet connection persists during the session
- Users need to reconnect after page refresh (can be improved with localStorage)
- The modal theme is set to 'dark' to match the app design
- Modal mode is 'alwaysAsk' to give users choice of wallet each time
