# 🎯 Post-Approval Implementation Guide

## ✅ Current Status: Approval is WORKING!

The lender can now approve borrowers, and the contract successfully:
1. ✅ Transfers STRK tokens from lender to borrower (ON-CHAIN)
2. ✅ Sets `repayment_deadline` = current_timestamp + `repayment_period` (ON-CHAIN)
3. ✅ Updates application status to 1 (approved) (ON-CHAIN)
4. ✅ Emits `BorrowerApproved` event with deadline (ON-CHAIN)

## 🔧 What Needs to be Implemented

### 1. **Approved Loans Section (Borrower Side)** ⚠️ HIGH PRIORITY

**Location**: `frontend/src/pages/LoanBorrowerFlowNew.jsx`

**Status**: Backend already returns approved loans via `/api/loan/borrower/:commitment/active`

**What to Display**:
- ✅ Loan amount received
- ✅ Interest rate
- ✅ Repayment amount (principal + interest)
- ✅ Repayment deadline timestamp
- ⚡ **COUNTDOWN TIMER** - Time remaining to repay

**Frontend Implementation**:
```javascript
// In LoanBorrowerFlowNew.jsx, around line 800-900

const [activeLoans, setActiveLoans] = useState([]);

// Calculate time remaining
const calculateTimeRemaining = (deadline) => {
  const now = Date.now();
  const deadlineMs = new Date(deadline).getTime();
  const remaining = deadlineMs - now;
  
  if (remaining <= 0) {
    return { expired: true, text: '⚠️ OVERDUE' };
  }
  
  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  
  return {
    expired: false,
    text: `${days}d ${hours}h ${minutes}m remaining`,
    percentage: (remaining / (loan.repaymentPeriod * 1000)) * 100
  };
};

// UI Component
<div className="active-loans-section">
  <h3>💰 Active Loans (Approved)</h3>
  {activeLoans.map(loan => {
    const timeRemaining = calculateTimeRemaining(loan.repaymentDeadline);
    const repaymentAmount = parseFloat(loan.amount) + parseFloat(loan.interestAmount);
    
    return (
      <div key={loan.loanId} className={`loan-card ${timeRemaining.expired ? 'overdue' : ''}`}>
        <div className="loan-header">
          <h4>Loan #{loan.loanId}</h4>
          <span className="status-badge">✅ Approved</span>
        </div>
        
        <div className="loan-details">
          <p><strong>Received:</strong> {loan.amount} STRK</p>
          <p><strong>Must Repay:</strong> {repaymentAmount} STRK</p>
          <p><strong>Interest Rate:</strong> {loan.interestRate / 100}%</p>
        </div>
        
        <div className="countdown-timer">
          <div className="timer-text">{timeRemaining.text}</div>
          {!timeRemaining.expired && (
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${timeRemaining.percentage}%` }}
              />
            </div>
          )}
        </div>
        
        {!timeRemaining.expired ? (
          <button 
            onClick={() => handleRepayLoan(loan.loanId)} 
            className="repay-button"
          >
            💸 Repay Now
          </button>
        ) : (
          <div className="overdue-warning">
            ⚠️ LOAN OVERDUE - Identity may be revealed to lender
          </div>
        )}
      </div>
    );
  })}
</div>
```

---

### 2. **Repayment Function (Borrower Side)** ⚠️ HIGH PRIORITY

**Location**: `frontend/src/pages/LoanBorrowerFlowNew.jsx`

**Backend Already Supports**: Contract has `repay_loan(loan_id)` function

**Implementation**:
```javascript
const handleRepayLoan = async (loanId) => {
  try {
    setLoading(true);
    
    // Calculate repayment amount
    const loan = activeLoans.find(l => l.loanId === loanId);
    const repaymentAmount = BigInt(loan.amount) + BigInt(loan.interestAmount);
    
    console.log('💸 Repaying loan:', loanId, 'Amount:', repaymentAmount.toString());
    
    // Approve STRK token spending
    const strkTokenAddress = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
    const escrowAddress = '0x05a4d3ed7d102ab91715c2b36c70b5e9795a3e917214dbd9af40503d2c29f83d';
    
    // Step 1: Approve escrow to spend STRK
    const approvalTx = await starknet.account.execute({
      contractAddress: strkTokenAddress,
      entrypoint: 'approve',
      calldata: [
        escrowAddress,
        uint256.bnToUint256(repaymentAmount).low.toString(),
        uint256.bnToUint256(repaymentAmount).high.toString()
      ]
    });
    
    console.log('⏳ Waiting for approval tx:', approvalTx.transaction_hash);
    await provider.waitForTransaction(approvalTx.transaction_hash);
    console.log('✅ STRK spending approved!');
    
    // Step 2: Call repay_loan
    const loanIdU256 = uint256.bnToUint256(BigInt(loanId));
    const repayTx = await starknet.account.execute({
      contractAddress: escrowAddress,
      entrypoint: 'repay_loan',
      calldata: [loanIdU256.low.toString(), loanIdU256.high.toString()]
    });
    
    console.log('⏳ Waiting for repayment tx:', repayTx.transaction_hash);
    await provider.waitForTransaction(repayTx.transaction_hash);
    console.log('✅ Loan repaid successfully!');
    
    alert('✅ Loan repaid successfully! You are now debt-free.');
    
    // Refresh active loans
    await loadActiveLoans();
    
  } catch (error) {
    console.error('❌ Error repaying loan:', error);
    alert(`Failed to repay loan: ${error.message}`);
  } finally {
    setLoading(false);
  }
};
```

---

### 3. **Approved Loans Display (Lender Side)** ⚡ MEDIUM PRIORITY

**Location**: `frontend/src/pages/LoanLenderFlow.jsx`

**Current**: Lender can see applications but not which ones are approved

**What to Add**:
- Filter applications by status (pending / approved / repaid)
- Show countdown timer for approved loans
- Show "OVERDUE" badge if past deadline
- Button to reveal borrower identity (if overdue)

**Implementation**:
```javascript
// In LoanLenderFlow.jsx, update the applications display

<div className="applications-list">
  <div className="status-tabs">
    <button 
      onClick={() => setStatusFilter('pending')}
      className={statusFilter === 'pending' ? 'active' : ''}
    >
      ⏳ Pending
    </button>
    <button 
      onClick={() => setStatusFilter('approved')}
      className={statusFilter === 'approved' ? 'active' : ''}
    >
      ✅ Approved
    </button>
    <button 
      onClick={() => setStatusFilter('repaid')}
      className={statusFilter === 'repaid' ? 'active' : ''}
    >
      💰 Repaid
    </button>
  </div>
  
  {filteredApplications.map(app => {
    const isOverdue = app.status === 'approved' && 
                      new Date(app.repaymentDeadline) < new Date();
    
    return (
      <div key={app.borrowerCommitment} className="application-card">
        <div className="commitment-display">
          <strong>Borrower ID:</strong>
          <code>{app.borrowerCommitment}</code>
        </div>
        
        {app.status === 'approved' && (
          <div className="repayment-info">
            <p><strong>Deadline:</strong> {new Date(app.repaymentDeadline).toLocaleString()}</p>
            {!isOverdue ? (
              <p className="time-remaining">
                ⏰ {calculateTimeRemaining(app.repaymentDeadline)}
              </p>
            ) : (
              <div className="overdue-section">
                <p className="overdue-badge">⚠️ OVERDUE</p>
                <button 
                  onClick={() => handleRevealBorrower(app.loanId, app.borrowerCommitment)}
                  className="reveal-button"
                >
                  🔓 Reveal Borrower Identity
                </button>
              </div>
            )}
          </div>
        )}
        
        {app.status === 'pending' && (
          <button onClick={() => handleApprove(app.loanId, app.borrowerCommitment)}>
            ✅ Approve
          </button>
        )}
        
        {app.status === 'repaid' && (
          <div className="repaid-badge">✅ REPAID</div>
        )}
      </div>
    );
  })}
</div>
```

---

### 4. **Identity Reveal Function (ON-CHAIN)** 🔴 CONTRACT CHANGE NEEDED

**Problem**: Current contract does NOT have a `reveal_borrower()` function!

**Solution**: Need to add to `loan_escrow_zk.cairo`:

```cairo
/// Reveal borrower identity if loan is overdue
fn reveal_borrower_identity(
    self: @ContractState,
    loan_id: u256,
    borrower_commitment: felt252,
) -> ContractAddress {
    let caller = get_caller_address();
    let timestamp = get_block_timestamp();
    let loan = self.loan_offers.read(loan_id);
    let app = self.applications.read((loan_id, borrower_commitment));

    // Only lender can reveal
    assert(caller == loan.lender, 'Only lender can reveal');
    
    // Only if loan is approved
    assert(app.status == 1, 'Loan not approved');
    
    // Only if past deadline
    assert(timestamp > app.repayment_deadline, 'Not past deadline');
    
    // Return borrower address
    app.borrower
}
```

**Add to Interface**:
```cairo
fn reveal_borrower_identity(
    self: @TContractState,
    loan_id: u256,
    borrower_commitment: felt252,
) -> ContractAddress;
```

---

### 5. **Backend Endpoint for Identity Reveal** ⚡ BACKEND ADDITION

**Location**: `backend/src/routes/loanRoutes_onchain.js`

**New Endpoint**:
```javascript
/**
 * Reveal borrower identity (only if loan is overdue)
 * GET /api/loan/:loanId/reveal/:commitment
 */
router.get('/:loanId/reveal/:commitment', async (req, res) => {
  try {
    const { loanId, commitment } = req.params;
    
    logger.info(`🔓 [REVEAL] Attempting to reveal borrower for loan ${loanId}...`);
    
    const { low: loanLow, high: loanHigh } = uint256.bnToUint256(BigInt(loanId));
    
    // Get application details
    const appRawResult = await provider.callContract({
      contractAddress: LOAN_ESCROW_ZK_ADDRESS,
      entrypoint: 'get_application',
      calldata: [loanLow, loanHigh, commitment]
    });
    
    const application = {
      borrower: appRawResult.result[0],
      status: Number(appRawResult.result[3]),
      approved_at: Number(appRawResult.result[5]),
      repayment_deadline: Number(appRawResult.result[7])
    };
    
    // Check if overdue
    const now = Math.floor(Date.now() / 1000);
    const isOverdue = now > application.repayment_deadline;
    
    if (!isOverdue) {
      return res.status(403).json({
        success: false,
        canReveal: false,
        message: 'Loan is not overdue yet. Cannot reveal borrower identity.',
        deadline: new Date(application.repayment_deadline * 1000).toISOString(),
        timeRemaining: application.repayment_deadline - now
      });
    }
    
    // If overdue, return borrower address
    logger.info(`✅ [REVEAL] Loan is overdue. Revealing borrower: ${application.borrower}`);
    
    res.json({
      success: true,
      canReveal: true,
      revealed: true,
      borrower: application.borrower,
      commitment,
      loanId,
      overdueBy: now - application.repayment_deadline,
      message: 'Borrower identity revealed due to loan default'
    });
    
  } catch (error) {
    logger.error('❌ [REVEAL] Error revealing borrower:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
```

---

## 📊 Summary of Changes Needed

### ✅ Already Working (No Changes):
1. STRK token transfer on approval
2. Repayment deadline calculation
3. Backend returning approved loans with deadlines

### 🔧 Frontend Changes (No Contract Changes):
1. Add "Active Loans" section to borrower page
2. Display countdown timer
3. Implement repay loan button/function
4. Add status filters to lender applications view
5. Display repayment deadline on lender side

### 🔴 Requires Contract Redeployment:
1. Add `reveal_borrower_identity()` function to contract
2. Redeploy contract to StarkNet Sepolia
3. Update contract address in env variables

### ⚡ Backend Addition (No Contract Changes):
1. Add `/api/loan/:loanId/reveal/:commitment` endpoint
2. Add logic to check if loan is overdue

---

## 🚀 Implementation Priority

### Phase 1: Frontend Only (Can Do NOW)
- [ ] Add active loans display to borrower page
- [ ] Add countdown timer component
- [ ] Implement repay loan function
- [ ] Add status filters to lender page
- [ ] Show "OVERDUE" badge

### Phase 2: Backend Addition (Can Do NOW)
- [ ] Add reveal endpoint
- [ ] Add overdue checking logic

### Phase 3: Contract Changes (Requires Redeploy)
- [ ] Add reveal function to contract
- [ ] Redeploy contract
- [ ] Test reveal function

---

## 💡 Quick Win: Start with Phase 1!

You can implement everything in **Phase 1** RIGHT NOW without any contract changes. The borrower can see their active loans, countdown timer, and repay functionality. The lender can see application statuses and know when loans are overdue.

The identity reveal feature (Phase 3) requires a contract change, so save that for later!
