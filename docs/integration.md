# Integration Guide

## Overview

This guide covers integrating the ZK Affordability Loan platform with wallets, payroll providers, and client applications.

## Wallet Integration

### StarkNet Wallet (Argent X, Braavos)

#### Connect Wallet

```javascript
import { connect } from 'get-starknet';

// Connect to wallet
const starknet = await connect();
await starknet.enable();

// Get account address
const [address] = await starknet.account.address;
```

#### Sign Transaction

```javascript
// Prepare transaction from backend API
const response = await fetch('/api/loan/create-request', {
  method: 'POST',
  body: JSON.stringify({
    borrowerAddress: address,
    amount: 1000,
    threshold: 30000,
    proofHash: '0x...',
    commitment: '0x...'
  })
});

const { contractAddress, functionName, calldata } = await response.json();

// Execute transaction
const tx = await starknet.account.execute({
  contractAddress,
  entrypoint: functionName,
  calldata: Object.values(calldata)
});

await starknet.provider.waitForTransaction(tx.transaction_hash);
```

### MetaMask (EVM)

#### Connect Wallet

```javascript
// Request account access
const accounts = await window.ethereum.request({
  method: 'eth_requestAccounts'
});

const address = accounts[0];
```

#### Sign Transaction

```javascript
const { ethers } = require('ethers');

// Connect to contract
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

const escrowAddress = '0x...';
const escrowABI = [...];
const escrow = new ethers.Contract(escrowAddress, escrowABI, signer);

// Create loan request
const tx = await escrow.createLoanRequest(
  amount,
  threshold,
  proofHash,
  borrowerCommit
);

await tx.wait();
```

## Payroll Integration

### Plaid Integration

#### Setup

```bash
npm install plaid
```

#### Initialize

```javascript
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const client = new PlaidApi(configuration);
```

#### Create Link Token

```javascript
// Backend
const response = await fetch('/api/payroll/plaid/start', {
  method: 'POST',
  body: JSON.stringify({ userId: 'user123' })
});

const { linkToken } = await response.json();

// Frontend - Initialize Plaid Link
const handler = Plaid.create({
  token: linkToken,
  onSuccess: async (publicToken, metadata) => {
    // Exchange token on backend
    await fetch('/api/payroll/plaid/callback', {
      method: 'POST',
      body: JSON.stringify({ publicToken, userId: 'user123' })
    });
  }
});

handler.open();
```

#### Get Income Data

```javascript
// After OAuth flow completes
const response = await fetch('/api/payroll/plaid/income', {
  method: 'POST',
  body: JSON.stringify({ accessToken })
});

const { attestation } = await response.json();
// attestation.income.annualIncome
```

### ADP Integration

```javascript
// Configure ADP credentials in .env
// ADP_CLIENT_ID=...
// ADP_CLIENT_SECRET=...

// Get income attestation
const response = await fetch('/api/payroll/adp/income', {
  method: 'POST',
  body: JSON.stringify({ workerId: 'W12345' })
});

const { attestation } = await response.json();
```

### Custom Employer API

```javascript
// Register employer endpoint
await fetch('/api/payroll/custom/register', {
  method: 'POST',
  body: JSON.stringify({
    employerId: 'ACME_CORP',
    config: {
      baseUrl: 'https://api.acmecorp.com',
      apiKey: 'key123',
      authType: 'bearer'
    }
  })
});

// Get income attestation
const response = await fetch('/api/payroll/custom/income', {
  method: 'POST',
  body: JSON.stringify({
    employerId: 'ACME_CORP',
    employeeId: 'EMP001'
  })
});
```

## ZK Proof Generation

### Client-Side (Recommended)

```javascript
import { groth16 } from 'snarkjs';

// Load circuit files
const wasmBuffer = await fetch('/circuits/incomeVerifier.wasm')
  .then(r => r.arrayBuffer());
const zkeyBuffer = await fetch('/circuits/incomeVerifier.zkey')
  .then(r => r.arrayBuffer());

// Prepare inputs (salary NEVER sent to server)
const inputs = {
  salary: '50000',
  threshold: '30000',
  salt: generateRandomSalt()
};

// Generate proof
const { proof, publicSignals } = await groth16.fullProve(
  inputs,
  new Uint8Array(wasmBuffer),
  new Uint8Array(zkeyBuffer)
);

// Generate commitment
const commitment = publicSignals[0];

// Now submit to create loan request
await fetch('/api/loan/create-request', {
  method: 'POST',
  body: JSON.stringify({
    borrowerAddress,
    amount: 1000,
    threshold: 30000,
    proofHash: hashProof(proof),
    commitment
  })
});
```

### Server-Side (Less Private)

```javascript
// Only use if client-side not possible
const response = await fetch('/api/proof/generate', {
  method: 'POST',
  body: JSON.stringify({
    salary: 50000,
    threshold: 30000,
    salt: generateRandomSalt()
  })
});

const { proof, publicSignals } = await response.json();
```

## Complete Loan Flow

### 1. Borrower Creates Loan Request

```javascript
// Step 1: Get payroll attestation
const attestation = await getPayrollAttestation();
const salary = attestation.income.annualIncome;

// Step 2: Generate ZK proof
const threshold = 30000;
const salt = generateRandomSalt();
const { proof, publicSignals } = await generateProof(salary, threshold, salt);
const commitment = publicSignals[0];

// Step 3: Encrypt identity
const identityData = {
  name: attestation.identity.name,
  email: attestation.identity.email,
  ssn: 'xxx-xx-xxxx',
  employerName: attestation.payroll.employerName
};

const encryptResponse = await fetch('/api/identity/encrypt-and-store', {
  method: 'POST',
  body: JSON.stringify({ identityData, borrowerAddress })
});

const { cid, shares } = await encryptResponse.json();

// Step 4: Distribute shares to trustees
await fetch('/api/identity/distribute-shares', {
  method: 'POST',
  body: JSON.stringify({
    shares,
    loanId: 'pending',
    borrowerAddress
  })
});

// Step 5: Create loan request on-chain
const proofHash = hashProof(proof);
await createLoanRequestTransaction({
  amount: 1000,
  threshold,
  proofHash,
  borrowerCommit: commitment
});
```

### 2. Lender Funds Loan

```javascript
// Step 1: Review loan request
const loan = await fetch(`/api/loan/${loanId}`).then(r => r.json());

// Step 2: Verify proof (on-chain or off-chain)
const isValid = await verifyProof(loan.proofHash);

// Step 3: Fund loan
await fundLoanTransaction({
  loanId,
  cid: loan.cid,
  amount: loan.amount
});
```

### 3. Borrower Makes Payment

```javascript
await reportPaymentTransaction({
  loanId,
  amount: 100
});
```

### 4. Default & Identity Reveal

```javascript
// Lender triggers default
await triggerDefaultTransaction({ loanId });

// Backend automatically:
// 1. Starts dispute window
// 2. Collects shares from trustees
// 3. Reconstructs encryption key
// 4. Decrypts identity
// 5. Provides to lender

// Lender retrieves identity
const response = await fetch(`/api/identity/reconstruct`, {
  method: 'POST',
  body: JSON.stringify({
    shares: collectedShares,
    cid: loan.cid
  })
});

const { identityData } = await response.json();
```

## Event Monitoring

```javascript
// Subscribe to loan events
const provider = new RpcProvider({ nodeUrl: STARKNET_RPC });

provider.getEvents({
  address: LOAN_ESCROW_CONTRACT,
  from_block: { block_number: 0 },
  to_block: 'latest',
  chunk_size: 100,
}).then(events => {
  events.forEach(event => {
    if (event.keys[0] === 'LoanRequested') {
      console.log('New loan requested:', event.data);
    }
  });
});
```

## Error Handling

```javascript
try {
  const response = await fetch('/api/loan/create-request', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }
  
  const result = await response.json();
} catch (error) {
  if (error.message.includes('insufficient funds')) {
    // Handle insufficient funds
  } else if (error.message.includes('proof verification failed')) {
    // Handle proof error
  } else {
    // Generic error
  }
}
```

## Testing

### Test Credentials

**Plaid Sandbox:**
- Username: `user_good`
- Password: `pass_good`
- Verification: `1234` (any 4 digits)

**Test Addresses:**
- Use StarkNet testnet (Goerli)
- Get test ETH from faucet

### Example Test Flow

```javascript
describe('Loan Flow', () => {
  it('should create and fund loan', async () => {
    // Generate test proof
    const proof = await generateTestProof(50000, 30000);
    
    // Create loan
    const loanId = await createLoanRequest({
      amount: 1000,
      threshold: 30000,
      proofHash: hashProof(proof),
      commitment: proof.publicSignals[0]
    });
    
    // Fund loan
    await fundLoan(loanId, 'QmTest...');
    
    // Verify state
    const loan = await getLoan(loanId);
    expect(loan.state).to.equal('active');
  });
});
```

## Production Checklist

- [ ] Use production Plaid environment
- [ ] Configure production IPFS (not sandbox)
- [ ] Deploy to mainnet
- [ ] Audit smart contracts
- [ ] Perform trusted setup ceremony
- [ ] Setup monitoring and alerts
- [ ] Configure trustee infrastructure
- [ ] Enable rate limiting
- [ ] Setup backup systems
- [ ] Document incident response plan
