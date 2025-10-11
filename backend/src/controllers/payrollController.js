const plaidAdapter = require('../services/payrollAdapters/plaidAdapter');
const adpAdapter = require('../services/payrollAdapters/adpAdapter');
const bankApiAdapter = require('../services/payrollAdapters/bankApiAdapter');
const logger = require('../utils/logger');

/**
 * Controller for payroll OAuth flows and attestations
 */
class PayrollController {
  /**
   * Start Plaid OAuth flow
   */
  async startPlaidOAuth(req, res) {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const linkToken = await plaidAdapter.createLinkToken(userId);

      logger.info('Plaid OAuth flow started', { userId });

      res.json({
        provider: 'plaid',
        linkToken: linkToken.link_token,
        expiration: linkToken.expiration,
        requestId: linkToken.request_id
      });
    } catch (error) {
      logger.error('Start Plaid OAuth failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Handle Plaid OAuth callback
   */
  async plaidCallback(req, res) {
    try {
      const { publicToken, userId } = req.body;

      if (!publicToken || !userId) {
        return res.status(400).json({
          error: 'Missing required fields: publicToken, userId'
        });
      }

      // Exchange public token for access token
      const { accessToken, itemId } = await plaidAdapter.exchangePublicToken(publicToken);

      // Generate income attestation
      const attestation = await plaidAdapter.generateIncomeAttestation(accessToken);

      logger.info('Plaid OAuth completed', { userId, itemId });

      res.json({
        message: 'Plaid connection successful',
        provider: 'plaid',
        itemId,
        attestation,
        userId
      });
    } catch (error) {
      logger.error('Plaid callback failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get income attestation from Plaid
   */
  async getPlaidIncome(req, res) {
    try {
      const { accessToken } = req.body;

      if (!accessToken) {
        return res.status(400).json({ error: 'Access token required' });
      }

      const attestation = await plaidAdapter.generateIncomeAttestation(accessToken);

      logger.info('Plaid income attestation generated');

      res.json({
        provider: 'plaid',
        attestation,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Get Plaid income failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get income attestation from ADP
   */
  async getADPIncome(req, res) {
    try {
      const { workerId } = req.body;

      if (!workerId) {
        return res.status(400).json({ error: 'Worker ID required' });
      }

      const attestation = await adpAdapter.generateIncomeAttestation(workerId);

      logger.info('ADP income attestation generated', { workerId });

      res.json({
        provider: 'adp',
        attestation,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Get ADP income failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Register custom employer API
   */
  async registerEmployer(req, res) {
    try {
      const { employerId, config } = req.body;

      if (!employerId || !config) {
        return res.status(400).json({
          error: 'Missing required fields: employerId, config'
        });
      }

      if (!config.baseUrl || !config.apiKey) {
        return res.status(400).json({
          error: 'Config must include baseUrl and apiKey'
        });
      }

      bankApiAdapter.registerEmployer(employerId, config);

      logger.info('Custom employer registered', { employerId });

      res.json({
        message: 'Employer registered successfully',
        employerId,
        baseUrl: config.baseUrl
      });
    } catch (error) {
      logger.error('Register employer failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get income attestation from custom employer API
   */
  async getCustomIncome(req, res) {
    try {
      const { employerId, employeeId } = req.body;

      if (!employerId || !employeeId) {
        return res.status(400).json({
          error: 'Missing required fields: employerId, employeeId'
        });
      }

      const attestation = await bankApiAdapter.generateIncomeAttestation(
        employerId,
        employeeId
      );

      logger.info('Custom income attestation generated', {
        employerId,
        employeeId
      });

      res.json({
        provider: 'custom',
        employerId,
        attestation,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Get custom income failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Receive payroll webhook attestation
   */
  async receiveWebhook(req, res) {
    try {
      const { provider, data, signature } = req.body;

      if (!provider || !data) {
        return res.status(400).json({
          error: 'Missing required fields: provider, data'
        });
      }

      // In production, verify webhook signature
      // For now, log the received webhook

      logger.info('Payroll webhook received', {
        provider,
        dataKeys: Object.keys(data)
      });

      res.json({
        message: 'Webhook received successfully',
        provider,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Receive webhook failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Validate payroll attestation
   */
  async validateAttestation(req, res) {
    try {
      const { attestation } = req.body;

      if (!attestation) {
        return res.status(400).json({ error: 'Attestation required' });
      }

      const requiredFields = ['provider', 'timestamp', 'identity', 'income'];
      const missingFields = requiredFields.filter(field => !attestation[field]);

      if (missingFields.length > 0) {
        return res.status(400).json({
          error: 'Invalid attestation',
          missingFields
        });
      }

      // Check attestation age
      const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days
      const attestationDate = new Date(attestation.timestamp);
      const age = Date.now() - attestationDate.getTime();

      const isValid = age <= maxAge;

      logger.info('Attestation validated', {
        provider: attestation.provider,
        isValid,
        age
      });

      res.json({
        valid: isValid,
        age,
        maxAge,
        provider: attestation.provider
      });
    } catch (error) {
      logger.error('Validate attestation failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new PayrollController();
