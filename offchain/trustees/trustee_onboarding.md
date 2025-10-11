# Trustee Share Management

This directory contains documentation and tools for trustee operations in the Shamir Secret Sharing scheme.

## Overview

Trustees hold encrypted identity key shares using Shamir's Secret Sharing. A threshold of trustees (default 2-of-3) must cooperate to reconstruct the encryption key and reveal borrower identity in case of loan default.

## Trustee Responsibilities

1. **Receive shares**: Accept and securely store shares from the platform
2. **Protect shares**: Prevent unauthorized access or leakage
3. **Respond to requests**: Provide shares when valid default is triggered
4. **Maintain availability**: Ensure share retrieval is possible
5. **Audit operations**: Log all share requests and releases

## Setup

### Prerequisites

- Secure server (preferably HSM-backed)
- HTTPS endpoint for share reception
- Database for share storage (encrypted at rest)
- Logging and monitoring infrastructure

### Installation

```bash
npm install express helmet rate-limit
```

### Basic Trustee Server

```javascript
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(helmet());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// In-memory storage (USE DATABASE IN PRODUCTION)
const shares = new Map();

// Receive share endpoint
app.post('/api/receive-share', async (req, res) => {
  try {
    const { loanId, borrowerAddress, shareId, share, timestamp } = req.body;
    
    // Validate request
    if (!loanId || !share || !shareId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Verify request authenticity (add signature verification)
    // TODO: Verify signature from platform
    
    // Store share (encrypt before storing in production)
    const key = `${loanId}:${shareId}`;
    shares.set(key, {
      loanId,
      borrowerAddress,
      share,
      receivedAt: new Date().toISOString(),
      requestTimestamp: timestamp
    });
    
    console.log(`Share received: ${shareId} for loan ${loanId}`);
    
    res.json({
      success: true,
      shareId,
      receivedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to receive share:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Request share endpoint (default scenario)
app.post('/api/request-share', async (req, res) => {
  try {
    const { loanId, timestamp, reason } = req.body;
    
    if (!loanId) {
      return res.status(400).json({ error: 'Loan ID required' });
    }
    
    // Verify default was actually triggered on-chain
    // TODO: Verify blockchain state before releasing share
    
    // Find share for this loan
    let foundShare = null;
    for (const [key, value] of shares.entries()) {
      if (value.loanId === loanId) {
        foundShare = value.share;
        break;
      }
    }
    
    if (!foundShare) {
      return res.status(404).json({ error: 'Share not found for loan' });
    }
    
    console.log(`Share requested for loan ${loanId}, reason: ${reason}`);
    
    res.json({
      share: foundShare,
      loanId,
      releasedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to provide share:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', shares: shares.size });
});

const PORT = process.env.TRUSTEE_PORT || 4000;
app.listen(PORT, () => {
  console.log(`Trustee server running on port ${PORT}`);
});
```

## Security Best Practices

### 1. Secure Storage

**Do:**
- Encrypt shares at rest (AES-256)
- Use HSM for key storage
- Regular backups (encrypted)
- Access control logs

**Don't:**
- Store shares in plain text
- Use weak encryption
- Allow public read access
- Skip backups

### 2. Authentication & Authorization

```javascript
// Verify request signature
const crypto = require('crypto');

function verifySignature(data, signature, publicKey) {
  const verify = crypto.createVerify('SHA256');
  verify.update(JSON.stringify(data));
  return verify.verify(publicKey, signature, 'hex');
}

app.post('/api/receive-share', (req, res) => {
  const { signature, ...data } = req.body;
  
  if (!verifySignature(data, signature, PLATFORM_PUBLIC_KEY)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process share...
});
```

### 3. Rate Limiting

```javascript
const shareRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  keyGenerator: (req) => req.body.loanId,
  message: 'Too many share requests for this loan'
});

app.post('/api/request-share', shareRequestLimiter, handler);
```

### 4. Audit Logging

```javascript
function auditLog(action, data) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    loanId: data.loanId,
    ip: data.ip,
    userAgent: data.userAgent
  };
  
  // Write to secure audit log
  console.log('AUDIT:', JSON.stringify(entry));
  // Also write to database/file
}
```

## Production Deployment

### Infrastructure

1. **High Availability**
   - Deploy across multiple regions
   - Load balancer with health checks
   - Automatic failover

2. **Database**
   - PostgreSQL with encryption
   - Regular backups
   - Replication for redundancy

3. **Monitoring**
   - Uptime monitoring
   - Alert on anomalous requests
   - Dashboard for share status

### Environment Variables

```env
TRUSTEE_PORT=4000
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=... # For share encryption
PLATFORM_PUBLIC_KEY=... # For signature verification
LOG_LEVEL=info
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 4000
CMD ["node", "trustee_api_stub.js"]
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: trustee-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: trustee
  template:
    metadata:
      labels:
        app: trustee
    spec:
      containers:
      - name: trustee
        image: trustee-service:latest
        ports:
        - containerPort: 4000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: trustee-secrets
              key: database-url
```

## Operating Procedures

### 1. Receiving Share

When a new share arrives:
1. Validate request signature
2. Check loan exists on blockchain
3. Encrypt and store share
4. Log receipt
5. Confirm to platform

### 2. Default Triggered

When default event detected:
1. Verify on-chain default state
2. Check dispute window passed
3. Wait for share request
4. Verify requester authorization
5. Release share
6. Log release

### 3. Emergency Procedures

**Share Compromise:**
1. Immediately notify platform
2. Rotate encryption keys
3. Invalidate compromised shares
4. Investigate breach

**System Downtime:**
1. Activate backup trustee
2. Restore from encrypted backup
3. Verify share integrity
4. Resume operations

## Compliance

### Data Retention

- Keep shares for loan duration + 1 year
- Securely delete after retention period
- Maintain audit logs for 7 years

### Access Control

- Multi-factor authentication for admins
- Principle of least privilege
- Regular access reviews
- Immediate revocation on termination

## Testing

### Test Share Reception

```bash
curl -X POST http://localhost:4000/api/receive-share \
  -H "Content-Type: application/json" \
  -d '{
    "loanId": "test123",
    "borrowerAddress": "0xtest",
    "shareId": "trustee_1",
    "share": "test_share_data",
    "timestamp": 1234567890
  }'
```

### Test Share Request

```bash
curl -X POST http://localhost:4000/api/request-share \
  -H "Content-Type: application/json" \
  -d '{
    "loanId": "test123",
    "timestamp": 1234567890,
    "reason": "default_triggered"
  }'
```

## Trustee Coordination

For multi-trustee setup:

1. **Trustee 1**: Primary, highest uptime SLA
2. **Trustee 2**: Secondary, different jurisdiction
3. **Trustee 3**: Backup, different infrastructure

Communication protocol:
- Share receipt confirmation
- Periodic health checks
- Coordinated share release
- Incident response

## Legal Considerations

- **Jurisdiction**: Clarify legal jurisdiction
- **Liability**: Define trustee liability limits
- **Data Protection**: GDPR/CCPA compliance
- **Subpoenas**: Legal request procedures

## Support

For trustee onboarding or issues:
- Email: trustees@example.com
- Documentation: https://docs.example.com/trustees
- Emergency: +1-xxx-xxx-xxxx
