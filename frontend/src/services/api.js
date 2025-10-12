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

// Loan API
export const loanApi = {
  createRequest: async (borrowerAddress, amount, threshold, proofHash, commitment) => {
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
    const response = await api.post('/api/loans/fund', {
      loanId,
      lenderAddress,
      cid,
    });
    return response.data;
  },
  
  getLoanDetails: async (loanId) => {
    const response = await api.get(`/api/loans/${loanId}`);
    return response.data;
  },
  
  getUserLoans: async (userAddress) => {
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
