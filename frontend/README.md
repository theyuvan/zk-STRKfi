# ZK Affordability Loan - Frontend

React-based frontend for the ZK Affordability Loan platform with wallet connection and Zero-Knowledge proof generation.

## Features

- **Multi-Chain Support**: Connect with StarkNet (Argent, Braavos) or Ethereum (MetaMask)
- **ZK Proof Generation**: Client-side zero-knowledge proof creation for income verification
- **File Upload**: Secure identity document upload with encryption
- **Loan Management**: Create and manage loan requests
- **Real-time Dashboard**: Track loan status and history

## Setup

### Install Dependencies

```bash
npm install
```

### Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your contract addresses after deployment.

### Run Development Server

```bash
npm run dev
```

Frontend will be available at `http://localhost:3001`

## Contract Deployment

Before using the frontend, deploy the smart contracts:

```bash
# From contracts directory
cd ../contracts

# Deploy EVM contracts
npm run deploy:evm

# Deploy StarkNet contracts (requires funded account)
npm run deploy:starknet
```

Update the `.env` file with the deployed contract addresses.

## Build for Production

```bash
npm run build
```

## Technology Stack

- React 18
- Vite
- TailwindCSS
- StarkNet.js
- Ethers.js
- SnarkJS
- React Query
- Zustand

## Security Notes

⚠️ **This is a demo application**
- Do not use with real funds
- Smart contracts are for testnet only
- All wallet signing happens client-side
- No private keys are stored or transmitted
