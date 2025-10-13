# 🧪 Post-Approval Features Testing Guide

## Quick Test Scenarios

### Scenario 1: Countdown Timer Test ⏰

**Goal**: Verify countdown timer displays and updates correctly

**Steps**:
1. Open borrower page with wallet connected
2. Generate ZK proof if needed
3. Apply for a loan (or use existing approved loan)
4. Wait for lender to approve
5. Check "Active Loans" section

**Expected Results**:
- ✅ Countdown timer visible
- ✅ Shows "X days X hours X minutes remaining"
- ✅ Updates every 60 seconds
- ✅ Color changes based on urgency:
  - Green: More than 2 days
  - Yellow: Less than 2 days
  - Red: Less than 6 hours

**Verification**:
```javascript
// Open browser console and run:
console.log('Current time:', new Date());
console.log('Deadline:', document.querySelector('.countdown-timer'));
```

---

### Scenario 2: Repayment Flow Test 💸

**Goal**: Test complete loan repayment process

**Prerequisites**:
- Approved loan exists
- Borrower has enough STRK (principal + interest)

**Steps**:
1. Go to borrower page
2. Find active loan in "Active Loans" section
3. Click "💸 Repay Now" button
4. Approve STRK spending (first transaction)
5. Wait for confirmation
6. Repay loan (second transaction)
7. Wait for confirmation

**Expected Results**:
- ✅ Two transactions executed
- ✅ Success alert shows total repaid amount
- ✅ Loan removed from "Active Loans"
- ✅ STRK balance updated
- ✅ Lender receives repayment

**Console Logs to Watch**:
```
💸 Repaying loan: 38
💰 Repayment breakdown:
  Principal: 0.0010 STRK
  Interest: 0.0001 STRK
  Total: 0.0011 STRK
📝 Approving STRK spending...
⏳ Waiting for approval tx: 0x...
✅ STRK spending approved!
💰 Calling repay_loan on contract...
⏳ Waiting for repayment tx: 0x...
✅ Loan repaid on blockchain!
```

---

### Scenario 3: Status Filters Test (Lender Side) 📊

**Goal**: Verify status filters work correctly

**Steps**:
1. Open lender page
2. Select a loan with multiple applications
3. Click "View Applications"
4. Click each filter tab

**Expected Results**:
- ✅ "All" shows all applications
- ✅ "Pending" shows only unapproved
- ✅ "Approved" shows only funded loans
- ✅ "Repaid" shows only completed loans
- ✅ Counts in tabs are accurate
- ✅ Active tab highlighted in cyan

**Test Data**:
Create loans with different statuses:
- Loan A: 3 pending, 0 approved, 0 repaid
- Loan B: 1 pending, 2 approved, 0 repaid
- Loan C: 0 pending, 1 approved, 1 repaid

---

### Scenario 4: Overdue Detection Test ⚠️

**Goal**: Test automatic overdue detection and identity reveal

**Prerequisites**:
- Create loan with SHORT repayment period (e.g., 5 minutes)
- Approve borrower
- Wait for deadline to pass

**Steps**:
1. Create loan: 
   - Amount: 0.001 STRK
   - Repayment period: 300 seconds (5 minutes)
2. Borrower applies
3. Lender approves
4. **WAIT 5 MINUTES** ⏱️
5. Refresh lender page
6. View applications for that loan

**Expected Results**:
- ✅ Status badge shows "⚠️ OVERDUE"
- ✅ Countdown timer shows "OVERDUE: X hours past deadline"
- ✅ Application card has red border
- ✅ "🔓 Reveal Borrower Identity" button visible
- ✅ Clicking reveal shows borrower address

**Backend Response**:
```bash
# Test reveal endpoint directly
curl http://localhost:3000/api/loan/38/reveal/0x22083c8b84ffd614c26468f2ada0c1baad4df98d81a0e1d7d757beb0155dd2d

# Expected (if overdue):
{
  "success": true,
  "canReveal": true,
  "revealed": true,
  "borrower": "0x2398452...330c24",
  "overdueDays": 0,
  "message": "Borrower identity revealed due to loan default"
}

# Expected (if NOT overdue):
{
  "success": false,
  "canReveal": false,
  "message": "Loan is not overdue yet. Cannot reveal borrower identity.",
  "timeRemainingHours": 2
}
```

---

### Scenario 5: Edge Cases 🔍

#### Test 5A: Timer During Page Refresh
**Steps**:
1. Load page with active loan
2. Note countdown time
3. Wait 2 minutes
4. Refresh page

**Expected**: Timer shows updated time (2 minutes less)

#### Test 5B: Multiple Active Loans
**Steps**:
1. Create 3 different loans
2. Apply to all 3 as borrower
3. Get approved for all 3
4. Check active loans section

**Expected**: All 3 loans display with separate countdown timers

#### Test 5C: Reveal Before Deadline
**Steps**:
1. Loan still has 2 hours remaining
2. Try to reveal identity via API

**Expected**: 403 error with time remaining info

#### Test 5D: Interest Calculation
**Steps**:
1. Loan: 1.0000 STRK at 5% interest (500 bps)
2. Check repay amount

**Expected**: 1.0500 STRK (1.00 + 0.05)

---

## 🐛 Common Issues & Solutions

### Issue 1: Countdown Timer Not Updating
**Symptom**: Timer shows same value after 1 minute

**Debug**:
```javascript
// Check if interval is running
console.log('Timer interval:', setInterval(() => {}, 60000));
```

**Solution**: Check browser console for errors, ensure `useEffect` cleanup is working

---

### Issue 2: Repay Button Does Nothing
**Symptom**: Click "Repay Now" but no transaction

**Debug**:
```javascript
// Check wallet connection
console.log('Wallet:', await connect());
console.log('Balance:', strkBalance);
```

**Solution**: 
- Ensure wallet is connected
- Check STRK balance is sufficient
- Verify contract address in env variables

---

### Issue 3: Reveal Returns 403
**Symptom**: "Cannot reveal identity" error

**Debug**:
```bash
# Check application status
curl http://localhost:3000/api/loan/38/applications

# Check current timestamp vs deadline
node -e "console.log(Date.now() / 1000, 'vs', deadline_from_response)"
```

**Solution**: 
- Wait for deadline to pass
- Verify application is in "approved" status (not pending or repaid)
- Check backend logs for exact error

---

### Issue 4: Status Filters Show Wrong Counts
**Symptom**: "Approved (3)" but only 1 application shown

**Debug**:
```javascript
// Check applications array
console.log('All apps:', applications);
console.log('Filtered:', applications.filter(a => a.status === 'approved'));
```

**Solution**: 
- Refresh applications data
- Check status mapping (pending=0, approved=1, repaid=2)
- Verify backend returns correct status

---

## 📊 Test Results Template

```markdown
## Test Run: [Date/Time]

### Environment:
- Backend: http://localhost:3000
- Frontend: http://localhost:5173
- Contract: 0x05a4d3ed...
- Test Wallet: 0x2398452...

### Scenario 1: Countdown Timer
- [ ] Timer visible
- [ ] Updates every minute
- [ ] Colors change by urgency
- [ ] Overdue state works

### Scenario 2: Repayment
- [ ] STRK approval successful
- [ ] Repay loan successful
- [ ] Balance updated
- [ ] Loan removed from active

### Scenario 3: Status Filters
- [ ] All filter works
- [ ] Pending filter works
- [ ] Approved filter works
- [ ] Repaid filter works

### Scenario 4: Overdue & Reveal
- [ ] Overdue detected
- [ ] Reveal button appears
- [ ] Identity revealed
- [ ] Borrower address displayed

### Edge Cases:
- [ ] Multiple active loans
- [ ] Page refresh
- [ ] Reveal before deadline (403)
- [ ] Interest calculation correct

### Issues Found:
[List any bugs or unexpected behavior]

### Notes:
[Additional observations]
```

---

## 🚀 Performance Metrics

Track these during testing:

1. **Timer Update Frequency**: Should be exactly 60 seconds
2. **STRK Approval Gas**: ~50k-100k gas
3. **Repay Transaction Gas**: ~100k-200k gas
4. **API Response Time**: <500ms for reveal endpoint
5. **Page Load Time**: <2s with multiple active loans

---

## 🔐 Security Checklist

- [x] Reveal endpoint validates deadline on backend (not just frontend)
- [x] Only approved loans can be revealed
- [x] Returns 403 if not overdue (not 200)
- [x] Borrower commitment verified exists
- [x] STRK approval amount matches calculation
- [x] No hardcoded private keys or sensitive data

---

## 📝 Manual Test Script

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend  
cd frontend
npm run dev

# Terminal 3: Monitor logs
tail -f backend/logs/*.log

# Browser: Open two tabs
# Tab 1: http://localhost:5173/borrower (Borrower)
# Tab 2: http://localhost:5173/lender (Lender, password: 12345678)
```

**Test Flow**:
1. Connect wallets in both tabs
2. Lender creates loan (short deadline: 5 minutes)
3. Borrower generates ZK proof
4. Borrower applies for loan
5. Lender approves (watch countdown start)
6. Wait 5 minutes
7. Lender clicks "View Applications"
8. Verify overdue badge and reveal button
9. Click reveal, verify address shown

---

**Happy Testing! 🎉**

*Remember: Always test on Sepolia testnet before mainnet deployment!*
