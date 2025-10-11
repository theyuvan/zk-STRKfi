import { create } from 'zustand';

export const useLoanStore = create((set) => ({
  // Current loan request data
  loanAmount: '',
  incomeThreshold: '',
  salary: '',
  proofData: null,
  encryptedIdentity: null,
  
  // Set loan amount
  setLoanAmount: (amount) => set({ loanAmount: amount }),
  
  // Set income threshold
  setIncomeThreshold: (threshold) => set({ incomeThreshold: threshold }),
  
  // Set salary
  setSalary: (salary) => set({ salary: salary }),
  
  // Set proof data
  setProofData: (proof) => set({ proofData: proof }),
  
  // Set encrypted identity
  setEncryptedIdentity: (identity) => set({ encryptedIdentity: identity }),
  
  // Reset loan data
  resetLoan: () => set({
    loanAmount: '',
    incomeThreshold: '',
    salary: '',
    proofData: null,
    encryptedIdentity: null,
  }),
  
  // User loans
  userLoans: [],
  setUserLoans: (loans) => set({ userLoans: loans }),
}));
