# Offchain Infrastructure

This directory contains offchain services supporting the ZK Affordability Loan platform.

## Components

### 1. IPFS Pinning Service (`ipfs-pinning/`)

Manages IPFS pinning via Pinata API for encrypted identity data.

**Purpose**: Ensure encrypted borrower identity remains available on IPFS for the loan duration.

**Key Functions**:
- `pinJSON(data, name)`: Pin encrypted identity to IPFS
- `testAuthentication()`: Verify Pinata API credentials
- `getPinList(filters)`: List pinned content
- `unpin(hash)`: Remove content from pinning

**Setup**:
```bash
cd ipfs-pinning
npm install
```

**Environment**:
```env
IPFS_API_KEY=your_pinata_api_key
IPFS_API_SECRET=your_pinata_secret
```

**Usage**:
```javascript
const pinService = require('./pinService');

// Pin encrypted data
const cid = await pinService.pinJSON(
  { encryptedData: '...', metadata: '...' },
  'loan_identity_123'
);

// Check pin status
const pins = await pinService.getPinList({ status: 'pinned' });
```

### 2. Trustee Services (`trustees/`)

Distributed trustee infrastructure for Shamir Secret Sharing.

**Purpose**: Hold encrypted identity key shares with threshold reconstruction for default scenarios.

**Components**:
- `trustee_api_stub.js`: API server for receiving/providing shares
- `trustee_onboarding.md`: Trustee setup and operational procedures

**Endpoints**:
- `POST /api/receive-share`: Store a share (called by platform)
- `POST /api/request-share`: Retrieve a share (default scenario)
- `GET /health`: Health check
- `GET /api/share-status/:loanId`: Check share status

**Setup**:
```bash
cd trustees
npm install
npm start
```

**Environment**:
```env
TRUSTEE_PORT=4000
NODE_ENV=production
```

**Security Requirements**:
- ⚠️ **Production**: Replace in-memory storage with encrypted database
- ⚠️ Implement signature verification for requests
- ⚠️ Add authentication and authorization
- ⚠️ Enable audit logging
- ⚠️ Use HTTPS only
- ⚠️ Implement rate limiting

**Architecture**:
```
Platform Backend → Trustee 1 (stores share 1)
                 ↘ Trustee 2 (stores share 2)
                 ↘ Trustee 3 (stores share 3)

On Default:
Trustee 1 + Trustee 2 → Reconstruct Key → Decrypt Identity
```

## Integration with Main Backend

### Identity Encryption Flow

1. Backend encrypts identity data (AES-256-GCM)
2. Backend splits encryption key into 3 shares (Shamir 2-of-3)
3. Backend sends each share to respective trustee
4. Backend pins encrypted identity to IPFS
5. Backend stores IPFS CID on-chain

### Default Flow

1. Default event detected on-chain
2. Backend requests shares from trustees (need 2-of-3)
3. Backend reconstructs encryption key
4. Backend retrieves encrypted data from IPFS
5. Backend decrypts identity
6. Lender can pursue collection

## Deployment

### Development

```bash
# Start IPFS pinning service (included in main backend)
# Start trustee services
cd offchain/trustees
npm start
```

### Production

**IPFS Pinning**:
- Integrated into main backend
- Ensure Pinata credentials configured
- Monitor pinning quota

**Trustees**:
- Deploy 3+ independent trustee servers
- Different jurisdictions recommended
- Use HSM for key storage
- Implement database encryption
- Setup monitoring and alerting

**Docker Compose Example**:
```yaml
version: '3.8'
services:
  trustee1:
    build: ./trustees
    environment:
      - TRUSTEE_PORT=4001
      - DATABASE_URL=...
    ports:
      - "4001:4001"
  
  trustee2:
    build: ./trustees
    environment:
      - TRUSTEE_PORT=4002
      - DATABASE_URL=...
    ports:
      - "4002:4002"
  
  trustee3:
    build: ./trustees
    environment:
      - TRUSTEE_PORT=4003
      - DATABASE_URL=...
    ports:
      - "4003:4003"
```

## Security Considerations

### IPFS Pinning

✅ **Do**:
- Encrypt data before pinning
- Use strong encryption keys (256-bit)
- Verify CID matches expected hash
- Monitor pinning status

❌ **Don't**:
- Pin unencrypted sensitive data
- Share Pinata credentials
- Pin without access control planning

### Trustees

✅ **Do**:
- Use separate infrastructure for each trustee
- Encrypt shares at rest
- Verify requests before releasing shares
- Maintain audit logs
- Implement geographic distribution

❌ **Don't**:
- Run all trustees on same infrastructure
- Store shares in plain text
- Release shares without verification
- Skip logging

## Monitoring

### IPFS Metrics

- Pinning success rate
- Pin duration
- API quota usage
- Failed pin attempts

### Trustee Metrics

- Share reception rate
- Share request frequency
- Response time
- Storage capacity
- Availability (uptime)

## Disaster Recovery

### IPFS

**Scenario**: Pinata service down
- Fallback: Use alternative pinning service (Infura, web3.storage)
- Backup: Keep encrypted data in secure database

### Trustees

**Scenario**: Trustee unavailable
- Solution: Need only 2-of-3 trustees
- Backup: Deploy additional trustees

**Scenario**: Share loss
- Solution: Backup encrypted shares
- Recovery: Restore from secure backup

## Testing

### Test IPFS Pinning

```bash
node -e "
const pinService = require('./ipfs-pinning/pinService');
(async () => {
  const cid = await pinService.pinJSON({ test: 'data' }, 'test');
  console.log('CID:', cid);
})();
"
```

### Test Trustee API

```bash
# Receive share
curl -X POST http://localhost:4000/api/receive-share \
  -H "Content-Type: application/json" \
  -d '{"loanId":"test","shareId":"t1","share":"abc123"}'

# Request share
curl -X POST http://localhost:4000/api/request-share \
  -H "Content-Type: application/json" \
  -d '{"loanId":"test","reason":"default"}'
```

## Cost Estimation

### IPFS (Pinata)

- Free tier: 1GB storage, 100 pins
- Paid plans: Starting $20/month
- Estimated cost: ~$0.01 per loan

### Trustees

- Server costs: $20-50/month per trustee
- 3 trustees: $60-150/month
- Scale with loan volume

## License

MIT License - see LICENSE file
