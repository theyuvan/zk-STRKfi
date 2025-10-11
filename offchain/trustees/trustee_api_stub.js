const express = require('express');
const helmet = require('helmet');

const app = express();
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

// In-memory storage (USE ENCRYPTED DATABASE IN PRODUCTION)
const shares = new Map();

/**
 * Receive and store a Shamir share
 */
app.post('/api/receive-share', async (req, res) => {
  try {
    const { loanId, borrowerAddress, shareId, share, timestamp } = req.body;
    
    // Validation
    if (!loanId || !share || !shareId) {
      return res.status(400).json({ 
        error: 'Missing required fields: loanId, share, shareId' 
      });
    }

    // TODO: Verify signature from platform
    // TODO: Encrypt share before storage
    
    const key = `${loanId}:${shareId}`;
    shares.set(key, {
      loanId,
      borrowerAddress,
      share,
      receivedAt: new Date().toISOString(),
      requestTimestamp: timestamp
    });
    
    console.log(`✓ Share received: ${shareId} for loan ${loanId}`);
    
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

/**
 * Provide share upon valid request (after default)
 */
app.post('/api/request-share', async (req, res) => {
  try {
    const { loanId, timestamp, reason, trusteeIndex } = req.body;
    
    if (!loanId) {
      return res.status(400).json({ error: 'Loan ID required' });
    }
    
    // TODO: Verify default was actually triggered on blockchain
    // TODO: Verify dispute window has passed
    // TODO: Authenticate requester
    
    // Find share for this loan
    let foundShare = null;
    let foundKey = null;
    
    for (const [key, value] of shares.entries()) {
      if (value.loanId === loanId) {
        foundShare = value.share;
        foundKey = key;
        break;
      }
    }
    
    if (!foundShare) {
      return res.status(404).json({ 
        error: 'Share not found for loan',
        loanId 
      });
    }
    
    console.log(`✓ Share released for loan ${loanId}, reason: ${reason}`);
    
    // Log this release for audit
    console.log('AUDIT: Share released', {
      loanId,
      reason,
      timestamp: new Date().toISOString(),
      key: foundKey
    });
    
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

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    sharesStored: shares.size
  });
});

/**
 * Get share status for a loan (admin only in production)
 */
app.get('/api/share-status/:loanId', (req, res) => {
  const { loanId } = req.params;
  
  // TODO: Add authentication
  
  const loanShares = [];
  for (const [key, value] of shares.entries()) {
    if (value.loanId === loanId) {
      loanShares.push({
        shareId: key.split(':')[1],
        receivedAt: value.receivedAt
      });
    }
  }
  
  res.json({
    loanId,
    sharesCount: loanShares.length,
    shares: loanShares
  });
});

const PORT = process.env.TRUSTEE_PORT || 4000;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   Trustee API Server                   ║
║   Port: ${PORT}                         ║
║   Environment: ${process.env.NODE_ENV || 'development'}             ║
╚════════════════════════════════════════╝

⚠️  PRODUCTION WARNINGS:
  - Replace in-memory storage with encrypted database
  - Implement signature verification
  - Add authentication and authorization
  - Enable audit logging to secure storage
  - Use HTTPS only
  - Implement rate limiting
  - Add monitoring and alerting
  `);
});

module.exports = app;
