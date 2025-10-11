const { PlaidApi, PlaidEnvironments, Configuration } = require('plaid');
const logger = require('../../utils/logger');

class PlaidAdapter {
  constructor() {
    const configuration = new Configuration({
      basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
          'PLAID-SECRET': process.env.PLAID_SECRET,
        },
      },
    });

    this.client = new PlaidApi(configuration);
  }

  /**
   * Create link token for Plaid Link initialization
   * @param {string} userId - User identifier
   * @returns {object} Link token response
   */
  async createLinkToken(userId) {
    try {
      const response = await this.client.linkTokenCreate({
        user: { client_user_id: userId },
        client_name: 'ZK Affordability Loan',
        products: ['income', 'identity'],
        country_codes: ['US'],
        language: 'en',
        redirect_uri: process.env.PLAID_REDIRECT_URI,
      });

      logger.info('Plaid link token created', { userId });
      return response.data;
    } catch (error) {
      logger.error('Failed to create Plaid link token', {
        userId,
        error: error.message
      });
      throw new Error(`Plaid link token creation failed: ${error.message}`);
    }
  }

  /**
   * Exchange public token for access token
   * @param {string} publicToken - Public token from Plaid Link
   * @returns {object} Access token and item ID
   */
  async exchangePublicToken(publicToken) {
    try {
      const response = await this.client.itemPublicTokenExchange({
        public_token: publicToken,
      });

      logger.info('Plaid public token exchanged');
      return {
        accessToken: response.data.access_token,
        itemId: response.data.item_id
      };
    } catch (error) {
      logger.error('Failed to exchange Plaid public token', {
        error: error.message
      });
      throw new Error(`Public token exchange failed: ${error.message}`);
    }
  }

  /**
   * Get income verification data
   * @param {string} accessToken - Plaid access token
   * @returns {object} Income data
   */
  async getIncome(accessToken) {
    try {
      const response = await this.client.incomeGet({
        access_token: accessToken,
      });

      const incomeData = response.data.income;
      const lastYearIncome = incomeData.last_year_income;
      const projectedYearlyIncome = incomeData.projected_yearly_income;

      logger.info('Retrieved Plaid income data', {
        lastYearIncome,
        projectedYearlyIncome
      });

      return {
        annualIncome: projectedYearlyIncome || lastYearIncome,
        lastYearIncome,
        projectedYearlyIncome,
        incomeStreams: incomeData.income_streams || []
      };
    } catch (error) {
      logger.error('Failed to get Plaid income', {
        error: error.message
      });
      throw new Error(`Income retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get identity verification data
   * @param {string} accessToken - Plaid access token
   * @returns {object} Identity data
   */
  async getIdentity(accessToken) {
    try {
      const response = await this.client.identityGet({
        access_token: accessToken,
      });

      const accounts = response.data.accounts;
      const identity = accounts[0]?.owners[0];

      logger.info('Retrieved Plaid identity data');

      return {
        name: identity?.names[0],
        email: identity?.emails[0]?.data,
        phone: identity?.phone_numbers[0]?.data,
        address: identity?.addresses[0]
      };
    } catch (error) {
      logger.error('Failed to get Plaid identity', {
        error: error.message
      });
      throw new Error(`Identity retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get payroll income (paystub data)
   * @param {string} accessToken - Plaid access token
   * @returns {object} Payroll data
   */
  async getPayrollIncome(accessToken) {
    try {
      const response = await this.client.incomePaystubsGet({
        access_token: accessToken,
      });

      const paystubs = response.data.paystubs || [];
      
      if (paystubs.length === 0) {
        throw new Error('No paystubs found');
      }

      const latestPaystub = paystubs[0];
      const earnings = latestPaystub.earnings;
      
      logger.info('Retrieved Plaid paystub data', {
        paystubCount: paystubs.length
      });

      return {
        employerName: latestPaystub.employer?.name,
        payPeriod: latestPaystub.pay_period_details,
        grossPay: earnings?.total?.current_amount,
        netPay: latestPaystub.net_pay?.current_amount,
        ytdGrossPay: earnings?.total?.ytd_amount,
        paystubs: paystubs.map(ps => ({
          payDate: ps.pay_period_details?.end_date,
          grossPay: ps.earnings?.total?.current_amount,
          netPay: ps.net_pay?.current_amount
        }))
      };
    } catch (error) {
      logger.error('Failed to get Plaid payroll income', {
        error: error.message
      });
      throw new Error(`Payroll income retrieval failed: ${error.message}`);
    }
  }

  /**
   * Generate income attestation from Plaid data
   * @param {string} accessToken - Plaid access token
   * @returns {object} Attestation object
   */
  async generateIncomeAttestation(accessToken) {
    try {
      const [income, identity, payroll] = await Promise.all([
        this.getIncome(accessToken),
        this.getIdentity(accessToken),
        this.getPayrollIncome(accessToken)
      ]);

      const attestation = {
        provider: 'plaid',
        timestamp: new Date().toISOString(),
        identity: {
          name: identity.name,
          email: identity.email
        },
        income: {
          annualIncome: income.annualIncome,
          lastYearIncome: income.lastYearIncome,
          projectedYearlyIncome: income.projectedYearlyIncome
        },
        payroll: {
          employerName: payroll.employerName,
          ytdGrossPay: payroll.ytdGrossPay,
          latestPayPeriod: payroll.payPeriod
        },
        verified: true
      };

      logger.info('Generated Plaid income attestation');
      return attestation;
    } catch (error) {
      logger.error('Failed to generate attestation', {
        error: error.message
      });
      throw new Error(`Attestation generation failed: ${error.message}`);
    }
  }
}

module.exports = new PlaidAdapter();
