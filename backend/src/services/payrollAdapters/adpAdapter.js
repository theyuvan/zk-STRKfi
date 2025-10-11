const axios = require('axios');
const logger = require('../../utils/logger');

/**
 * ADP Payroll Adapter
 * Note: Requires ADP Marketplace integration setup
 */
class ADPAdapter {
  constructor() {
    this.clientId = process.env.ADP_CLIENT_ID;
    this.clientSecret = process.env.ADP_CLIENT_SECRET;
    this.baseUrl = 'https://api.adp.com';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get OAuth access token
   * @returns {string} Access token
   */
  async getAccessToken() {
    try {
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      const response = await axios.post(
        `${this.baseUrl}/auth/oauth/v2/token`,
        {
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

      logger.info('ADP access token obtained');
      return this.accessToken;
    } catch (error) {
      logger.error('Failed to get ADP access token', {
        error: error.message
      });
      throw new Error(`ADP authentication failed: ${error.message}`);
    }
  }

  /**
   * Get worker information
   * @param {string} workerId - Worker ID (associateOID)
   * @returns {object} Worker data
   */
  async getWorkerInfo(workerId) {
    try {
      const token = await this.getAccessToken();

      const response = await axios.get(
        `${this.baseUrl}/hr/v2/workers/${workerId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        }
      );

      logger.info('Retrieved ADP worker info', { workerId });
      return response.data;
    } catch (error) {
      logger.error('Failed to get ADP worker info', {
        workerId,
        error: error.message
      });
      throw new Error(`Worker info retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get worker compensation data
   * @param {string} workerId - Worker ID
   * @returns {object} Compensation data
   */
  async getCompensation(workerId) {
    try {
      const token = await this.getAccessToken();

      const response = await axios.get(
        `${this.baseUrl}/hr/v2/workers/${workerId}/compensation`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        }
      );

      const compensation = response.data.workers[0]?.compensation;
      const baseSalary = compensation?.baseSalary;

      logger.info('Retrieved ADP compensation data', { workerId });

      return {
        annualSalary: baseSalary?.annualAmount,
        payFrequency: baseSalary?.payFrequency,
        currency: baseSalary?.currency,
        effectiveDate: baseSalary?.effectiveDate
      };
    } catch (error) {
      logger.error('Failed to get ADP compensation', {
        workerId,
        error: error.message
      });
      throw new Error(`Compensation retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get payroll information
   * @param {string} workerId - Worker ID
   * @returns {object} Payroll data
   */
  async getPayroll(workerId) {
    try {
      const token = await this.getAccessToken();

      const response = await axios.get(
        `${this.baseUrl}/payroll/v2/workers/${workerId}/pay-statements`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        }
      );

      const payStatements = response.data.payStatements || [];

      logger.info('Retrieved ADP payroll data', {
        workerId,
        statementCount: payStatements.length
      });

      return {
        payStatements: payStatements.map(stmt => ({
          payDate: stmt.payDate,
          grossPay: stmt.grossPay?.amount,
          netPay: stmt.netPay?.amount,
          payPeriod: {
            start: stmt.payPeriod?.startDate,
            end: stmt.payPeriod?.endDate
          }
        }))
      };
    } catch (error) {
      logger.error('Failed to get ADP payroll', {
        workerId,
        error: error.message
      });
      throw new Error(`Payroll retrieval failed: ${error.message}`);
    }
  }

  /**
   * Generate income attestation from ADP data
   * @param {string} workerId - Worker ID
   * @returns {object} Attestation object
   */
  async generateIncomeAttestation(workerId) {
    try {
      const [workerInfo, compensation, payroll] = await Promise.all([
        this.getWorkerInfo(workerId),
        this.getCompensation(workerId),
        this.getPayroll(workerId)
      ]);

      const worker = workerInfo.workers[0];
      const person = worker?.person;

      const attestation = {
        provider: 'adp',
        timestamp: new Date().toISOString(),
        identity: {
          name: person?.legalName?.formattedName,
          workerId: workerId
        },
        income: {
          annualSalary: compensation.annualSalary,
          payFrequency: compensation.payFrequency,
          currency: compensation.currency
        },
        payroll: {
          recentPayStatements: payroll.payStatements.slice(0, 3)
        },
        verified: true
      };

      logger.info('Generated ADP income attestation', { workerId });
      return attestation;
    } catch (error) {
      logger.error('Failed to generate ADP attestation', {
        workerId,
        error: error.message
      });
      throw new Error(`Attestation generation failed: ${error.message}`);
    }
  }
}

module.exports = new ADPAdapter();
