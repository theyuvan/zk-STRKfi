# 🚀 Quick Start Guide - Get Real Contract Addresses

This guide will help you deploy actual smart contracts and get real contract addresses.

## 📋 Table of Contents
- [Option 1: Local Development (Fastest)](#option-1-local-development-fastest)
- [Option 2: Sepolia Testnet](#option-2-sepolia-testnet)
- [Option 3: StarkNet Deployment](#option-3-starknet-deployment)

---

## Option 1: Local Development (Fastest) ⚡

**Best for:** Development and testing without spending real ETH

### Quick Method - Use PowerShell Script

```powershell
# Run the automated deployment script
.\deploy-contracts.ps1
```

Then select option `1` for local deployment.

### Manual Method

**Terminal 1 - Start Hardhat Network:**

```powershell
cd c:\zk-affordability-loan\contracts
npx hardhat node
```

Keep this terminal running. You'll see output like:
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/

Accounts
========
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
...
```

**Terminal 2 - Deploy Contracts:**

```powershell
cd c:\zk-affordability-loan\contracts
node scripts\deploy_local.js
```

You'll see output like:
```
✅ Escrow deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
✅ IdentityReveal deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

### Update Configuration

1. Create `backend\.env`:
```bash
cp backend\.env.example backend\.env
```

2. Add the deployed addresses to `backend\.env`:
```env
EVM_ESCROW_CONTRACT=0x5FbDB2315678afecb367f032d93F642f64180aa3
EVM_IDENTITY_REVEAL_CONTRACT=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

3. Create `frontend\.env`:
```bash
cp frontend\.env.example frontend\.env
```

4. Add the addresses with `VITE_` prefix to `frontend\.env`:
```env
VITE_EVM_ESCROW_CONTRACT=0x5FbDB2315678afecb367f032d93F642f64180aa3
VITE_EVM_IDENTITY_REVEAL_CONTRACT=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

✅ **Done!** You now have real contract addresses running on a local blockchain.

---

## Option 2: Sepolia Testnet 🌐

**Best for:** Testing with a public blockchain (persistent deployment)

### Step 1: Get Test ETH

Go to [Sepolia Faucet](https://sepoliafaucet.com/) and get some test ETH.

### Step 2: Configure Private Key

1. Export your wallet private key (from MetaMask):
   - MetaMask → Account Details → Export Private Key

2. Edit `backend\.env`:
```env
# NEVER commit this file! It's in .gitignore
DEPLOYER_PRIVATE_KEY=0x1234567890abcdef...your_private_key

# Get from Infura or Alchemy
EVM_RPC=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
```

### Step 3: Deploy

**Using PowerShell Script:**
```powershell
.\deploy-contracts.ps1
```
Select option `2`

**Or Manual:**
```powershell
cd c:\zk-affordability-loan\contracts
npx hardhat run scripts\deploy_local.js --network sepolia
```

### Step 4: Update Config Files

Same as Option 1, but these addresses will persist on Sepolia testnet!

---

## Option 3: StarkNet Deployment 🔷

**Best for:** Using StarkNet blockchain (Cairo contracts)

### Prerequisites

1. Install Python and Cairo:
```powershell
pip install cairo-lang
```

2. Create a StarkNet wallet:
   - Download [Argent X](https://www.argent.xyz/argent-x/) or [Braavos](https://braavos.app/)
   - Get testnet ETH from [StarkNet Faucet](https://faucet.goerli.starknet.io/)

### Step 1: Compile Cairo Contracts

```powershell
cd c:\zk-affordability-loan\contracts

# Compile payroll contract
starknet-compile starknet/payroll.cairo --output starknet/payroll_compiled.json --abi starknet/payroll_abi.json

# Compile loan escrow
starknet-compile starknet/loan_escrow.cairo --output starknet/loan_escrow_compiled.json --abi starknet/loan_escrow_abi.json

# Compile verifier
starknet-compile starknet/verifier_stub.cairo --output starknet/verifier_stub_compiled.json --abi starknet/verifier_stub_abi.json
```

### Step 2: Configure StarkNet Account

Add to `backend\.env`:
```env
STARKNET_ACCOUNT_ADDRESS=0x...your_starknet_address
STARKNET_PRIVATE_KEY=0x...your_private_key
STARKNET_RPC=https://starknet-goerli.infura.io/v3/YOUR_KEY
```

### Step 3: Deploy

```powershell
cd c:\zk-affordability-loan\contracts
node deploy\deploy_starknet_real.js
```

---

## 🎯 Recommended Workflow

For development, use this workflow:

1. **Start local network** (Terminal 1):
   ```powershell
   cd c:\zk-affordability-loan\contracts
   npx hardhat node
   ```

2. **Deploy contracts** (Terminal 2):
   ```powershell
   cd c:\zk-affordability-loan\contracts
   node scripts\deploy_local.js
   ```

3. **Update .env files** with the contract addresses

4. **Start backend** (Terminal 3):
   ```powershell
   cd c:\zk-affordability-loan\backend
   npm install
   npm start
   ```

5. **Start frontend** (Terminal 4):
   ```powershell
   cd c:\zk-affordability-loan\frontend
   npm install
   npm run dev
   ```

6. Open browser at `http://localhost:3001`

---

## 📝 Troubleshooting

### "Cannot find module hardhat"
```powershell
cd contracts
npm install
```

### "Insufficient funds for gas"
- **Local:** Make sure Hardhat node is running
- **Testnet:** Get more test ETH from faucet

### "Network connection failed"
- Check your internet connection
- Verify RPC URL in .env file

### Contracts not compiling
```powershell
cd contracts
npm install @openzeppelin/contracts
npx hardhat clean
npx hardhat compile
```

---

## 🔒 Security Notes

⚠️ **IMPORTANT:**
- NEVER commit private keys to Git
- `.env` files are in `.gitignore`
- Use separate wallets for testnet and mainnet
- The local network private keys are for testing only

---

## 📚 Additional Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [StarkNet Documentation](https://docs.starknet.io/)
- [Sepolia Faucet](https://sepoliafaucet.com/)
- [Infura](https://infura.io/) - Get RPC endpoints

---

## 🆘 Need Help?

If you encounter issues:
1. Check the error message carefully
2. Ensure all prerequisites are installed
3. Verify your .env configuration
4. See `contracts/DEPLOYMENT.md` for detailed instructions

**Common Issues:**
- Hardhat compatibility → We're using Hardhat 2.x with Ethers 6.x
- Cairo compilation → Ensure Python and cairo-lang are installed
- Network connection → Check RPC URLs and internet connection
