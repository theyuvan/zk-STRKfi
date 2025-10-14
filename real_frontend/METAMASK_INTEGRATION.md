# MetaMask & StarkNet Wallet Integration

## Overview
The Borrowers page now supports **both StarkNet and Ethereum wallets**:
- **StarkNet**: Ready Wallet (formerly Argent X), Braavos
- **Ethereum**: MetaMask

## Features Implemented

### 1. Dual Wallet Support
Users can choose between:
- **StarkNet Wallets** (Purple button) - Ready Wallet / Braavos
- **MetaMask** (Orange button) - Ethereum wallet

### 2. MetaMask Integration (`/lib/ethereum-wallet.ts`)

```typescript
// Connect MetaMask
connectMetaMask() → Returns { address, chainId, isConnected }

// Get ETH balance
getBalance(address) → Returns balance in ETH

// Listen for account changes
onAccountsChanged(callback)

// Listen for chain changes  
onChainChanged(callback)

// Switch to Ethereum Mainnet
switchToEthereumMainnet()
```

### 3. Auto-Detection & Event Listeners

**Account Changes:**
- Automatically detects when user switches accounts in MetaMask
- Updates UI with new address
- Clears analysis when disconnected

**Chain Changes:**
- Reloads page when user switches networks
- Ensures consistency

### 4. User Experience

**Header Buttons:**
- Shows both "StarkNet" and "MetaMask" buttons when not connected
- Shows "Connecting..." when wallet connection in progress
- Hides buttons after successful connection

**Connect Screen:**
- Large centered card with wallet options
- Purple gradient for StarkNet
- Orange gradient for MetaMask
- Responsive layout (stacks on mobile)

## Usage

### For Users

1. **Navigate to `/borrowers`**
2. **Choose your wallet:**
   - Click "StarkNet" for Argent X / Braavos
   - Click "MetaMask" for Ethereum wallet
3. **Approve connection** in wallet extension
4. **View eligibility** analysis automatically

### For Developers

**Connect StarkNet:**
```typescript
const handleConnectStarkNet = async () => {
  const wallet = await connectWallet()
  setWalletAddress(wallet.address)
  setWalletType('starknet')
}
```

**Connect MetaMask:**
```typescript
const handleConnectMetaMask = async () => {
  const wallet = await connectMetaMask()
  setWalletAddress(wallet.address)
  setWalletType('ethereum')
}
```

## Error Handling

### MetaMask Not Installed
```
Error: "MetaMask is not installed. Please install MetaMask extension."
```
User is prompted to install MetaMask browser extension.

### User Rejects Connection
```
Error: "User rejected the connection request"
```
User can retry by clicking the button again.

### Network Issues
All errors are logged to console and shown to user via alert.

## Testing

### Prerequisites
**For StarkNet:**
- Install [Ready Wallet](https://www.argent.xyz/) (formerly Argent X) or [Braavos](https://braavos.app/)

**For Ethereum:**
- Install [MetaMask](https://metamask.io/)

### Test Scenarios

1. **Test StarkNet Connection:**
   - Click "StarkNet" button
   - Select Argent or Braavos from modal
   - Approve connection
   - Verify address displays

2. **Test MetaMask Connection:**
   - Click "MetaMask" button
   - Approve in MetaMask popup
   - Verify address displays
   - Check eligibility analysis runs

3. **Test Account Switching:**
   - Connect MetaMask
   - Switch accounts in MetaMask extension
   - Verify UI updates with new address

4. **Test Disconnection:**
   - Connect wallet
   - Disconnect from extension
   - Verify UI resets

## Wallet Type Tracking

The app tracks which wallet type is connected:
```typescript
const [walletType, setWalletType] = useState<'starknet' | 'ethereum' | null>(null)
```

This allows for:
- Different analysis logic per wallet type
- Proper event listener management
- Network-specific features

## Next Steps

### Backend Integration

Replace mock analysis with real API calls:

```typescript
const analyzeWallet = async () => {
  const endpoint = walletType === 'starknet' 
    ? '/api/analyze-starknet'
    : '/api/analyze-ethereum'
    
  const response = await fetch(endpoint, {
    method: 'POST',
    body: JSON.stringify({ 
      address: walletAddress,
      walletType 
    })
  })
  
  const data = await response.json()
  setAnalysis(data)
}
```

### Fetch Real Wallet Data

**For Ethereum (MetaMask):**
- Balance: Use `getBalance(address)`
- Transactions: Query Etherscan API
- Account age: Check first transaction timestamp

**For StarkNet:**
- Use existing StarkNet RPC methods
- Query StarkScan API for transaction history

## Dependencies

```json
{
  "get-starknet-core": "^4.0.0",
  "starknet": "^6.11.0"
}
```

**No additional packages needed** - MetaMask integration uses native `window.ethereum` API.

## Browser Compatibility

- Chrome/Brave: ✅ Full support
- Firefox: ✅ Full support  
- Safari: ⚠️ MetaMask requires extension
- Edge: ✅ Full support

## Security Notes

- Never store private keys in frontend
- All wallet connections use official wallet APIs
- User must approve each connection
- Wallet extensions handle all cryptographic operations
