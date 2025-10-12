# ZK Affordability Loan Platform

> **Status**: ✅ Frontend + Backend Complete (66%) | ⏳ Smart Contracts Pending (33%)

A privacy-preserving loan platform using Zero-Knowledge proofs to verify wallet activity without revealing sensitive transaction data. Built on StarkNet Sepolia with real-time blockchain integration and automated loan monitoring.

## 🎯 What's New

### Latest Implementation (October 2025)
- ✅ **Complete Borrower Flow UI** - 5-step loan application process
- ✅ **Real StarkNet Integration** - Live STRK balance and transaction fetching
- ✅ **Activity Score Calculator** - 1000-point scoring from wallet metrics
- ✅ **Smart ZK Proof Caching** - 24-hour cache with automatic invalidation
- ✅ **Loan Monitoring Service** - 10-minute countdown with identity reveal
- ✅ **RESTful API** - Complete loan lifecycle endpoints

**Quick Start**: See [`QUICK_START.md`](QUICK_START.md) for setup instructions  
**Implementation Details**: See [`FINAL_SUMMARY.md`](FINAL_SUMMARY.md) for complete documentation

## 🚀 Quick Start

### Prerequisites
- Node.js v16+
- StarkNet wallet (Argent X or Braavos)
- STRK tokens on Sepolia testnet

### Run the Application

1. **Start Backend**
```bash
cd backend
npm install
npm start
# ✅ Server runs on http://localhost:3000
```

2. **Start Frontend**
```bash
cd frontend
npm install
npm run dev
# ✅ App runs on http://localhost:5173
```

3. **Access Borrower Flow**
Navigate to: **`http://localhost:5173/loan-borrower`**

## 🔄 User Flow

```
1. Connect Wallet (Argent X / Braavos)
         ↓
2. Fetch Activity (Real STRK balance + transaction history)
         ↓
3. Generate ZK Proof (Score calculation + proof caching)
         ↓
4. Apply for Loan (50 STRK, 5% interest, 500 score threshold)
         ↓
5. Repayment Timer (10 minutes countdown)
         ↓
   REPAY → Success ✅    OR    DEFAULT → Identity Revealed 🚨
```

## Architecture Overview

This system enables:
- **Privacy-Preserving Activity Verification**: Prove wallet activity score ≥ threshold without revealing exact metrics
- **Real Blockchain Integration**: Live data from StarkNet Sepolia testnet
- **Smart ZK Proof Caching**: Auto-invalidation on new transactions or score changes
- **Automated Loan Monitoring**: 10-minute countdown with automatic default handling
- **Identity Reveal on Default**: Console logging of borrower details (on-chain reveal pending)

## Components

### Backend (Node.js/Express)
- RESTful API for loan operations
- ZK proof generation using SnarkJS
- Payroll integration adapters
- IPFS encryption & pinning service
- Shamir Secret Sharing implementation
- Event watchers for on-chain activity

### Smart Contracts
- **StarkNet Cairo**: Payroll oracle, loan escrow, verifier stub
- **Solidity (Optional)**: EVM escrow and identity reveal contracts
- **ZK Circuits (Circom)**: Income verification circuit

### Off-chain Services
- IPFS pinning coordination
- Trustee share management
- Relayer infrastructure (optional)

## Quick Start

### Prerequisites

- Node.js >= 18.x
- Python >= 3.9 (for StarkNet)
- Rust (for Circom compilation)
- Git

### Installation

```bash
# Clone repository
git clone <your-repo-url>
cd zk-affordability-loan

# Install all dependencies
npm run install:all

# Build ZK circuits
npm run build:circuits

# Setup environment
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration
```

### Running the System

```bash
# Start backend server
npm run backend

# Deploy contracts (requires configured wallet)
npm run deploy:starknet
npm run deploy:evm  # Optional

# Start event watchers
npm run workers
```

## Documentation

- [Architecture](docs/architecture.md) - System design and flow diagrams
- [Security](docs/security.md) - Threat model and mitigations
- [Integration](docs/integration.md) - Payroll API and wallet integration

## Security Notes

⚠️ **IMPORTANT**: 
- Never commit private keys to this repository
- All wallet signing happens client-side
- Environment variables are for public endpoints and OAuth client IDs only
- Trustee shares must be distributed securely off-chain

## License

MIT
