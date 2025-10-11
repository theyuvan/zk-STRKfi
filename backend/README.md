# Backend Setup and API Documentation

## Overview

The backend is a Node.js/Express API that orchestrates the ZK loan platform. It handles proof generation, identity encryption, payroll integration, and blockchain interaction.

## Architecture

```
backend/
├── src/
│   ├── controllers/      # Request handlers
│   ├── services/         # Business logic
│   ├── routes/           # API endpoints
│   ├── workers/          # Background jobs
│   ├── utils/            # Helpers
│   └── config/           # Configuration
├── package.json
└── .env.example
```

## Key Principles

### 🔐 Security First

- **No private keys stored**: All signing happens client-side
- **No PII in logs**: Sensitive data never logged
- **Minimal trust**: Backend coordinates but doesn't control secrets

### 🎯 Stateless Design

- **Horizontal scaling**: No server-side session state
- **Blockchain as source of truth**: On-chain data is authoritative
- **Event-driven**: Workers react to blockchain events

## API Endpoints

### Loan Management

#### POST /api/loan/create-request

Create a new loan request. Returns transaction data for client-side signing.

**Request:**
```json
{
  "borrowerAddress": "0x...",
  "amount": "1000",
  "threshold": "30000",
  "proofHash": "0x...",
  "commitment": "0x..."
}
```

**Response:**
```json
{
  "message": "Loan request prepared. Sign and submit transaction.",
  "signatureMessage": { ... },
  "contractAddress": "0x...",
  "functionName": "create_loan_request",
  "calldata": { ... }
}
```

#### POST /api/loan/fund

Fund an existing loan.

**Request:**
```json
{
  "loanId": "1",
  "lenderAddress": "0x...",
  "cid": "Qm..."
}
```

#### POST /api/loan/report-payment

Report a loan payment.

**Request:**
```json
{
  "loanId": "1",
  "amount": "100",
  "borrowerAddress": "0x..."
}
```

#### POST /api/loan/trigger-default

Trigger default on a loan.

**Request:**
```json
{
  "loanId": "1",
  "lenderAddress": "0x..."
}
```

#### GET /api/loan/:loanId

Get loan details.

**Response:**
```json
{
  "loanId": "1",
  "borrower": "0x...",
  "lender": "0x...",
  "amount": "1000",
  "state": "active",
  "cid": "Qm..."
}
```

### Proof Management

#### POST /api/proof/prepare-inputs

Prepare inputs for proof generation.

**Request:**
```json
{
  "salary": 50000,
  "threshold": 30000
}
```

**Response:**
```json
{
  "inputs": {
    "salary": "50000",
    "threshold": "30000",
    "salt": "0x..."
  },
  "commitment": "0x...",
  "salt": "0x..."
}
```

#### POST /api/proof/generate

Generate proof server-side (use with caution - less private).

**Request:**
```json
{
  "salary": 50000,
  "threshold": 30000,
  "salt": "0x..."
}
```

**Response:**
```json
{
  "proof": { ... },
  "publicSignals": ["0x..."],
  "rawProof": { ... }
}
```

#### POST /api/proof/verify

Verify a ZK proof.

**Request:**
```json
{
  "proof": { ... },
  "publicSignals": ["0x..."]
}
```

**Response:**
```json
{
  "verified": true,
  "message": "Proof is valid"
}
```

### Identity Management

#### POST /api/identity/encrypt-and-store

Encrypt identity and upload to IPFS.

**Request:**
```json
{
  "identityData": {
    "name": "John Doe",
    "email": "john@example.com",
    "ssn": "xxx-xx-xxxx"
  },
  "borrowerAddress": "0x..."
}
```

**Response:**
```json
{
  "cid": "Qm...",
  "gatewayUrl": "https://gateway.pinata.cloud/ipfs/Qm...",
  "shares": [
    {
      "shareId": "trustee_1",
      "share": "...",
      "trusteeEndpoint": "https://..."
    }
  ],
  "threshold": 2,
  "total": 3
}
```

#### POST /api/identity/distribute-shares

Distribute Shamir shares to trustees.

**Request:**
```json
{
  "shares": [ ... ],
  "loanId": "1",
  "borrowerAddress": "0x..."
}
```

#### POST /api/identity/reconstruct

Reconstruct identity from shares.

**Request:**
```json
{
  "shares": ["...", "..."],
  "cid": "Qm..."
}
```

**Response:**
```json
{
  "identityData": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "sharesUsed": 2
}
```

### Payroll Integration

#### POST /api/payroll/plaid/start

Start Plaid OAuth flow.

**Request:**
```json
{
  "userId": "user123"
}
```

**Response:**
```json
{
  "provider": "plaid",
  "linkToken": "link-sandbox-...",
  "expiration": "2024-01-01T00:00:00Z"
}
```

#### POST /api/payroll/plaid/callback

Handle Plaid OAuth callback.

**Request:**
```json
{
  "publicToken": "public-sandbox-...",
  "userId": "user123"
}
```

**Response:**
```json
{
  "provider": "plaid",
  "itemId": "...",
  "attestation": {
    "income": {
      "annualIncome": 50000
    }
  }
}
```

## Services

### ZK Service

Handles circuit interaction and proof generation.

```javascript
const zkService = require('./services/zkService');

// Generate proof
const { proof, publicSignals } = await zkService.generateProof({
  salary: '50000',
  threshold: '30000',
  salt: '0x...'
});

// Verify proof
const isValid = await zkService.verifyProof(proof, publicSignals);
```

### IPFS Service

Manages encryption and IPFS storage.

```javascript
const ipfsService = require('./services/ipfsService');

// Encrypt and upload
const encryptedData = ipfsService.encryptData(data, password);
const cid = await ipfsService.uploadToIPFS(encryptedData);

// Retrieve and decrypt
const retrieved = await ipfsService.retrieveFromIPFS(cid);
const decrypted = ipfsService.decryptData(retrieved, password);
```

### Shamir Service

Implements secret sharing.

```javascript
const shamirService = require('./services/shamirService');

// Split secret
const shares = shamirService.splitSecret(secret, 3, 2);

// Reconstruct
const reconstructed = shamirService.combineShares([shares[0], shares[1]]);
```

## Workers

### Event Watcher

Monitors blockchain for loan events.

```javascript
const eventWatcher = require('./workers/eventWatcher');

// Start watching
await eventWatcher.start();

// Check status
const status = eventWatcher.getStatus();
```

### Share Collector

Collects shares from trustees after default.

```javascript
const shareCollector = require('./workers/shareCollector');

// Collect shares
const result = await shareCollector.collectShares(loanId);

// Reconstruct identity
const identity = await shareCollector.reconstructAndReveal(
  loanId,
  result.shares,
  cid
);
```

## Configuration

### Environment Variables

See `.env.example` for all available options:

- `PORT`: Server port (default: 3000)
- `STARKNET_RPC`: StarkNet RPC endpoint
- `IPFS_API_KEY`: Pinata API key
- `PLAID_CLIENT_ID`: Plaid client ID
- `TRUSTEE_THRESHOLD`: Shamir threshold (default: 2)
- `DISPUTE_WINDOW_SECONDS`: Dispute window (default: 604800)

### Logging

Logs are written to:
- `logs/error.log`: Error logs only
- `logs/combined.log`: All logs

Configure log level:
```env
LOG_LEVEL=info  # debug, info, warn, error
```

## Development

### Run in Development Mode

```bash
npm run dev
```

Uses nodemon for auto-reload.

### Run Workers

```bash
npm run workers
```

### Testing

```bash
npm test
```

## Production Deployment

### Environment Setup

1. **Set NODE_ENV:**
   ```env
   NODE_ENV=production
   ```

2. **Configure production RPC:**
   ```env
   STARKNET_RPC=https://starknet-mainnet.infura.io/v3/...
   ```

3. **Setup monitoring:**
   ```env
   SENTRY_DSN=https://...
   ```

### Process Management

Use PM2 for process management:

```bash
npm install -g pm2

# Start backend
pm2 start src/server.js --name zk-loan-backend

# Start workers
pm2 start src/workers/eventWatcher.js --name zk-loan-workers

# Monitor
pm2 monit

# Logs
pm2 logs
```

### Scaling

The backend is stateless and can be horizontally scaled:

```bash
pm2 start src/server.js -i 4  # 4 instances
```

## Security Considerations

1. **Never log sensitive data**: Salaries, private keys, PII
2. **Validate all inputs**: Use schema validation
3. **Rate limiting**: Prevent API abuse
4. **HTTPS only**: In production
5. **CORS configuration**: Restrict origins

## Client-Side Wallet Signing

The backend **never** signs transactions. All signing happens client-side:

```javascript
// Backend returns transaction data
const { contractAddress, functionName, calldata } = 
  await fetch('/api/loan/create-request', { ... });

// Client signs with wallet
const tx = await wallet.execute({
  contractAddress,
  entrypoint: functionName,
  calldata
});
```

This ensures:
- Backend never sees private keys
- Users maintain full control
- Non-custodial architecture

## Monitoring

Track these metrics:

- API response times
- Proof generation duration
- IPFS upload success rate
- Trustee share collection success
- Blockchain event processing lag

Example with Prometheus:
```javascript
const prometheus = require('prom-client');
const proofDuration = new prometheus.Histogram({
  name: 'proof_generation_duration',
  help: 'Proof generation duration in seconds'
});
```
