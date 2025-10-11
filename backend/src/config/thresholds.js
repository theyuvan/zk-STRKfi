module.exports = {
  // Trustee configuration
  trustee: {
    threshold: parseInt(process.env.TRUSTEE_THRESHOLD) || 2,
    total: parseInt(process.env.TRUSTEE_TOTAL) || 3
  },

  // Proof verification thresholds
  proof: {
    minIncomeThreshold: 30000, // Minimum annual income in USD (configurable per loan)
    maxProofAge: 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds
  },

  // Dispute window
  dispute: {
    windowSeconds: parseInt(process.env.DISPUTE_WINDOW_SECONDS) || 604800 // 7 days
  },

  // Payroll attestation
  payroll: {
    maxAttestationAge: 90 * 24 * 60 * 60 * 1000, // 90 days
    requiredFields: ['salary', 'employerName', 'employmentStatus', 'payFrequency']
  }
};
