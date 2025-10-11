# ZK Affordability Loan

A privacy-preserving loan platform using Zero-Knowledge proofs to verify income without revealing sensitive data. Built on StarkNet with encrypted identity storage and Shamir Secret Sharing for identity recovery.

## Architecture Overview

This system enables:
- **Privacy-Preserving Income Verification**: Borrowers prove income threshold without revealing exact salary
- **Encrypted Identity Storage**: Identity data encrypted and stored on IPFS with Shamir shares distributed to trustees
- **Smart Contract Escrow**: Loan lifecycle managed on StarkNet with automatic default handling
- **Payroll Oracle Integration**: Direct payroll data attestation via Plaid, ADP, or custom APIs
- **Optional Identity Reveal**: Default triggers trustee-based identity decryption

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
