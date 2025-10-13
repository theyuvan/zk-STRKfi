import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Proof API
export const proofApi = {
  prepareProofInputs: async (salary, threshold) => {
    const response = await api.post('/api/proof/prepare-inputs', { salary, threshold });
    return response.data;
  },
  
  generateProof: async (salary, threshold, salt) => {
    const response = await api.post('/api/proof/generate', { salary, threshold, salt });
    return response.data;
  },
  
  verifyProof: async (proof, publicSignals) => {
    const response = await api.post('/api/proof/verify', { proof, publicSignals });
    return response.data;
  },
};

// Loan API - ✅ ON-CHAIN ROUTES (matches loanRoutes_onchain.js)
export const loanApi = {
  // Get all available loan offers from blockchain
  getAvailableLoans: async () => {
    const response = await api.get('/api/loan/available');
    return response.data;
  },

  // Get loans created by a specific lender
  getLenderLoans: async (lenderAddress) => {
    const response = await api.get(`/api/loan/lender/${lenderAddress}`);
    return response.data;
  },

  // Get application details for a specific loan and commitment
  getApplication: async (loanId, commitment) => {
    const response = await api.get(`/api/loan/application/${loanId}/${commitment}`);
    return response.data;
  },

  // Get all applications for a borrower (by commitment)
  getBorrowerApplications: async (commitment) => {
    const response = await api.get(`/api/loan/borrower/${commitment}/applications`);
    return response.data;
  },

  // Register ZK proof on-chain
  registerProof: async (proofHash, commitment, activityScore) => {
    const response = await api.post('/api/loan/register-proof', {
      proofHash,
      commitment,
      activityScore,
    });
    return response.data;
  },

  // Legacy endpoints (kept for backward compatibility, but will be removed)
  createRequest: async (borrowerAddress, amount, threshold, proofHash, commitment) => {
    console.warn('⚠️ Using legacy createRequest - should use smart contract directly');
    const response = await api.post('/api/loans/create', {
      borrowerAddress,
      amount,
      threshold,
      proofHash,
      commitment,
    });
    return response.data;
  },
  
  fundLoan: async (loanId, lenderAddress, cid) => {
    console.warn('⚠️ Using legacy fundLoan - should use smart contract directly');
    const response = await api.post('/api/loans/fund', {
      loanId,
      lenderAddress,
      cid,
    });
    return response.data;
  },
  
  getLoanDetails: async (loanId) => {
    console.warn('⚠️ Using legacy getLoanDetails - use getApplication instead');
    const response = await api.get(`/api/loans/${loanId}`);
    return response.data;
  },
  
  getUserLoans: async (userAddress) => {
    console.warn('⚠️ Using legacy getUserLoans - use getLenderLoans or getBorrowerApplications instead');
    const response = await api.get(`/api/loans/user/${userAddress}`);
    return response.data;
  },
};

// Identity API
export const identityApi = {
  encryptAndUpload: async (identityData, borrowerAddress) => {
    const response = await api.post('/api/identity/encrypt', {
      identityData,
      borrowerAddress,
    });
    return response.data;
  },
  
  distributeShares: async (encryptionKey, borrowerAddress) => {
    const response = await api.post('/api/identity/distribute-shares', {
      encryptionKey,
      borrowerAddress,
    });
    return response.data;
  },
};

// Payroll API
export const payrollApi = {
  startPlaidOAuth: async (userId) => {
    const response = await api.post('/api/payroll/plaid/start', { userId });
    return response.data;
  },
  
  plaidCallback: async (publicToken, userId) => {
    const response = await api.post('/api/payroll/plaid/callback', {
      publicToken,
      userId,
    });
    return response.data;
  },
  
  getPlaidIncome: async (accessToken) => {
    const response = await api.post('/api/payroll/plaid/income', { accessToken });
    return response.data;
  },
};

export default api;
