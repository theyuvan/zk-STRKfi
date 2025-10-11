# Installation Guide

## Prerequisites

Before installing the ZK Affordability Loan platform, ensure you have the following installed:

### Required Software

1. **Node.js** (v18.x or higher)
   ```powershell
   # Download from https://nodejs.org/
   # Verify installation
   node --version
   npm --version
   ```

2. **Python** (v3.9 or higher) - for StarkNet tools
   ```powershell
   # Download from https://www.python.org/
   python --version
   pip --version
   ```

3. **Rust** - for Circom compilation
   ```powershell
   # Download from https://rustup.rs/
   # Verify installation
   rustc --version
   cargo --version
   ```

4. **Git**
   ```powershell
   git --version
   ```

5. **Redis** (for job queue) - Optional but recommended
   ```powershell
   # Windows: Download from https://github.com/microsoftarchive/redis/releases
   # Or use Docker:
   docker run -d -p 6379:6379 redis:alpine
   ```

### Optional Tools

- **Docker** - for containerized services
- **VS Code** - recommended IDE with Solidity/Cairo extensions

## Installation Steps

### 1. Clone Repository

```powershell
git clone <repository-url>
cd zk-affordability-loan
```

### 2. Install Dependencies

#### Root Dependencies

```powershell
npm install
```

#### Backend Dependencies

```powershell
cd backend
npm install
cd ..
```

#### Contract Dependencies

```powershell
cd contracts
npm install
cd ..
```

### 3. Install Circom

Circom is required for ZK circuit compilation:

```powershell
# Install circom
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom

# Verify installation
circom --version

# Return to project root
cd ..
```

### 4. Install SnarkJS

```powershell
npm install -g snarkjs
snarkjs --version
```

### 5. Install StarkNet Tools

```powershell
# Install Cairo compiler
pip install cairo-lang

# Install starknet-devnet (local testnet)
pip install starknet-devnet

# Verify installation
starknet --version
```

### 6. Setup Environment Variables

```powershell
# Copy example env file
Copy-Item backend\.env.example backend\.env

# Edit .env file with your configuration
notepad backend\.env
```

**Required Configuration:**

```env
# StarkNet RPC (get from Infura, Alchemy, or use local devnet)
STARKNET_RPC=https://starknet-goerli.infura.io/v3/YOUR_PROJECT_ID
STARKNET_NETWORK=goerli-alpha

# IPFS/Pinata (sign up at https://pinata.cloud)
IPFS_API_KEY=your_pinata_api_key
IPFS_API_SECRET=your_pinata_api_secret

# Plaid (sign up at https://plaid.com)
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENV=sandbox

# Redis (if using job queue)
REDIS_HOST=localhost
REDIS_PORT=6379

# Trustees (configure your trustee endpoints)
TRUSTEE_1_ENDPOINT=https://trustee1.example.com/api/receive-share
TRUSTEE_2_ENDPOINT=https://trustee2.example.com/api/receive-share
TRUSTEE_3_ENDPOINT=https://trustee3.example.com/api/receive-share
```

### 7. Build ZK Circuits

This step compiles the Circom circuits and generates proving/verification keys:

```powershell
# Make script executable (Git Bash or WSL)
chmod +x scripts/build_zk.sh

# Run build script
bash scripts/build_zk.sh
```

**For Windows PowerShell users**, run the commands manually:

```powershell
cd contracts\zk
mkdir build
cd build

# Compile circuit
circom ..\incomeVerifier.circom --r1cs --wasm --sym -o .

# Powers of Tau
snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First" -v -e="random"
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v

# Generate zkey
snarkjs groth16 setup incomeVerifier.r1cs pot12_final.ptau incomeVerifier_0000.zkey
snarkjs zkey contribute incomeVerifier_0000.zkey incomeVerifier.zkey --name="Contribution" -v -e="more random"

# Export verification key
snarkjs zkey export verificationkey incomeVerifier.zkey verification_key.json

cd ..\..\..
```

### 8. Compile Smart Contracts

#### StarkNet Contracts

```powershell
cd contracts
npm run compile:starknet
cd ..
```

#### Solidity Contracts (Optional)

```powershell
cd contracts
npm run compile:solidity
cd ..
```

### 9. Start Local Development Environment

#### Option A: Start All Services

```powershell
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start local StarkNet devnet (optional)
starknet-devnet --host 127.0.0.1 --port 5050

# Terminal 3: Start backend
cd backend
npm run dev

# Terminal 4: Start event watcher
cd backend
npm run workers
```

#### Option B: Start Backend Only

```powershell
cd backend
npm start
```

### 10. Verify Installation

Test the API is running:

```powershell
# Health check
curl http://localhost:3000/health

# Should return: {"status":"ok","timestamp":"..."}
```

## Deploying Contracts

### Deploy to StarkNet Testnet

1. **Fund your deployer account:**
   - Get testnet ETH from [StarkNet Faucet](https://faucet.goerli.starknet.io/)

2. **Deploy contracts:**
   ```powershell
   cd contracts
   node deploy/deploy_starknet.js
   ```

3. **Update .env with deployed addresses:**
   ```env
   STARKNET_PAYROLL_CONTRACT=0x...
   STARKNET_LOAN_ESCROW_CONTRACT=0x...
   STARKNET_VERIFIER_CONTRACT=0x...
   ```

### Deploy to EVM (Optional)

1. **Configure deployer private key:**
   ```env
   DEPLOYER_PRIVATE_KEY=0x...
   ```

2. **Deploy:**
   ```powershell
   cd contracts
   npx hardhat run deploy/deploy_evm.js --network goerli
   ```

## Troubleshooting

### Circom Build Fails

**Error**: `circom: command not found`

**Solution**: Ensure Rust and Circom are properly installed and in your PATH:
```powershell
$env:PATH += ";C:\path\to\circom\target\release"
```

### StarkNet Connection Fails

**Error**: `Failed to connect to StarkNet RPC`

**Solution**: 
- Verify STARKNET_RPC URL is correct
- Check Infura/Alchemy API key
- Try using local devnet: `http://127.0.0.1:5050`

### Redis Connection Error

**Error**: `Redis connection refused`

**Solution**:
- Ensure Redis is running: `redis-cli ping` (should return PONG)
- Or disable Redis features by commenting out retry queue code

### IPFS Upload Fails

**Error**: `IPFS upload failed`

**Solution**:
- Verify Pinata API keys are correct
- Check API quota limits
- Test connection: `curl -X POST "https://api.pinata.cloud/data/testAuthentication" -H "pinata_api_key: YOUR_KEY" -H "pinata_secret_api_key: YOUR_SECRET"`

### Out of Memory During Circuit Build

**Error**: `JavaScript heap out of memory`

**Solution**:
```powershell
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm run build:circuits
```

## Development Tools

### Recommended VS Code Extensions

- **Cairo** - Cairo language support
- **Solidity** - Solidity language support
- **Prettier** - Code formatting
- **ESLint** - JavaScript linting
- **REST Client** - API testing

### Testing API Endpoints

Create a `test.http` file:

```http
### Health Check
GET http://localhost:3000/health

### Prepare Proof Inputs
POST http://localhost:3000/api/proof/prepare-inputs
Content-Type: application/json

{
  "salary": 50000,
  "threshold": 30000
}

### Create Loan Request
POST http://localhost:3000/api/loan/create-request
Content-Type: application/json

{
  "borrowerAddress": "0x123...",
  "amount": "1000",
  "threshold": "30000",
  "proofHash": "0xabc...",
  "commitment": "0xdef..."
}
```

## Next Steps

After successful installation:

1. **Read the Documentation:**
   - [Architecture](docs/architecture.md)
   - [Security](docs/security.md)
   - [Integration](docs/integration.md)

2. **Test the Flow:**
   - Generate a test proof
   - Create a loan request
   - Fund a loan on testnet

3. **Setup Production:**
   - Perform security audit
   - Configure production APIs
   - Setup monitoring
   - Deploy to mainnet

## Support

For issues and questions:
- Check [Troubleshooting](#troubleshooting) section
- Review error logs in `backend/logs/`
- Open an issue on GitHub

## Security Notice

⚠️ **Important:**
- Never commit `.env` files
- Never share private keys
- Use hardware wallets in production
- Audit contracts before mainnet deployment
- Test thoroughly on testnet first
