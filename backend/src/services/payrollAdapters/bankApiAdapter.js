const axios = require('axios');
const logger = require('../../utils/logger');

/**
 * Generic Bank/Payroll API Adapter
 * Template for integrating custom employer payroll systems
 */
class BankApiAdapter {
  constructor() {
    this.endpoints = new Map();
  }

  /**
   * Register a custom employer endpoint
   * @param {string} employerId - Employer identifier
   * @param {object} config - API configuration
   */
  registerEmployer(employerId, config) {
    this.endpoints.set(employerId, {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      authType: config.authType || 'bearer',
      headers: config.headers || {}
    });

    logger.info('Registered employer endpoint', { employerId });
  }

  /**
   * Get employer configuration
   * @param {string} employerId - Employer identifier
   * @returns {object} Configuration
   */
  getEmployerConfig(employerId) {
    const config = this.endpoints.get(employerId);
    if (!config) {
      throw new Error(`Employer ${employerId} not registered`);
    }
    return config;
  }

  /**
   * Make authenticated request to employer API
   * @param {string} employerId - Employer identifier
   * @param {string} endpoint - API endpoint path
   * @param {object} options - Request options
   * @returns {object} Response data
   */
  async makeRequest(employerId, endpoint, options = {}) {
    try {
      const config = this.getEmployerConfig(employerId);

      const headers = {
        ...config.headers,
        ...(config.authType === 'bearer' && {
          'Authorization': `Bearer ${config.apiKey}`
        }),
        ...(config.authType === 'api-key' && {
          'X-API-Key': config.apiKey
        }),
        'Content-Type': 'application/json',
        ...options.headers
      };

      const response = await axios({
        method: options.method || 'GET',
        url: `${config.baseUrl}${endpoint}`,
        headers,
        data: options.data,
        params: options.params
      });

      logger.info('Employer API request successful', {
        employerId,
        endpoint,
        status: response.status
      });

      return response.data;
    } catch (error) {
      logger.error('Employer API request failed', {
        employerId,
        endpoint,
        error: error.message
      });
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  /**
   * Get employee payroll information
   * @param {string} employerId - Employer identifier
   * @param {string} employeeId - Employee identifier
   * @returns {object} Payroll data
   */
  async getEmployeePayroll(employerId, employeeId) {
    try {
      const data = await this.makeRequest(
        employerId,
        `/employees/${employeeId}/payroll`,
        { method: 'GET' }
      );

      logger.info('Retrieved employee payroll', { employerId, employeeId });
      return data;
    } catch (error) {
      logger.error('Failed to get employee payroll', {
        employerId,
        employeeId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get employee salary information
   * @param {string} employerId - Employer identifier
   * @param {string} employeeId - Employee identifier
   * @returns {object} Salary data
   */
  async getEmployeeSalary(employerId, employeeId) {
    try {
      const data = await this.makeRequest(
        employerId,
        `/employees/${employeeId}/compensation`,
        { method: 'GET' }
      );

      logger.info('Retrieved employee salary', { employerId, employeeId });
      return data;
    } catch (error) {
      logger.error('Failed to get employee salary', {
        employerId,
        employeeId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate income attestation from generic API
   * @param {string} employerId - Employer identifier
   * @param {string} employeeId - Employee identifier
   * @returns {object} Attestation object
   */
  async generateIncomeAttestation(employerId, employeeId) {
    try {
      const [payroll, salary] = await Promise.all([
        this.getEmployeePayroll(employerId, employeeId),
        this.getEmployeeSalary(employerId, employeeId)
      ]);

      const attestation = {
        provider: 'custom',
        employerId,
        timestamp: new Date().toISOString(),
        identity: {
          employeeId: employeeId,
          name: payroll.employeeName || salary.employeeName
        },
        income: {
          annualSalary: salary.annualSalary || salary.basePay,
          currency: salary.currency || 'USD',
          payFrequency: salary.payFrequency
        },
        payroll: {
          lastPayDate: payroll.lastPayDate,
          ytdGross: payroll.ytdGross
        },
        verified: true
      };

      logger.info('Generated custom income attestation', {
        employerId,
        employeeId
      });

      return attestation;
    } catch (error) {
      logger.error('Failed to generate custom attestation', {
        employerId,
        employeeId,
        error: error.message
      });
      throw new Error(`Attestation generation failed: ${error.message}`);
    }
  }
}

module.exports = new BankApiAdapter();
