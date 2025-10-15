# Reveal Borrower Identity Feature - Added to Real Frontend

## ✅ Changes Made

### 1. Added `revealBorrowerIdentity()` Function
**Location**: `c:\Users\USER\Loanzy\real_frontend\app\lenders\page.tsx` (after `approveBorrower` function)

**Purpose**: Reveal the identity of borrowers who failed to repay loans on time

```typescript
const revealBorrowerIdentity = async (loanId: string, borrowerCommitment: string) => {
  // 1. Verify loan is approved and overdue
  // 2. Check deadline has passed
  // 3. Call reveal_borrower_identity on-chain
  // 4. Fetch revealed identity from backend
  // 5. Display borrower's ZK identity and wallet address
}
```

**Key Features:**
- ✅ Verifies loan is approved before revealing
- ✅ Checks that repayment deadline has passed
- ✅ Calculates days overdue
- ✅ Calls `reveal_borrower_identity` on smart contract
- ✅ Proper felt252 conversion (63 hex chars max)
- ✅ Fetches revealed identity from backend API
- ✅ Shows both ZK Identity (commitment) and wallet address
- ✅ Toast notifications for user feedback
- ✅ Detailed console logging
- ✅ Alert popup with complete details
- ✅ Voyager transaction link

### 2. Added "Reveal Identity" Button
**Location**: Overdue warning section in applications view

**Before:**
```tsx
{isOverdue && (
  <div className="...">
    <p>⚠️ LOAN OVERDUE</p>
    <p>Borrower missed repayment deadline</p>
    <p>💡 You can now reveal the borrower's identity</p>
  </div>
)}
```

**After:**
```tsx
{isOverdue && (
  <div className="...">
    <p>⚠️ LOAN OVERDUE</p>
    <p>Borrower missed repayment deadline</p>
    <Button onClick={() => revealBorrowerIdentity(selectedLoan, app.borrowerCommitment)}>
      🔓 Reveal Borrower Identity
    </Button>
  </div>
)}
```

**Button Styling:**
- Red/orange gradient (matches overdue warning)
- Hover scale animation
- Shadow effect
- Full width
- Lock icon for visual clarity

## 🔄 How It Works

### Flow Diagram

```
1. BORROWER MISSES DEADLINE
   │
   ├─→ Application status = "approved"
   ├─→ Repayment deadline passed
   └─→ isOverdue = true
   
2. LENDER VIEWS APPLICATION
   │
   ├─→ "⚠️ LOAN OVERDUE" warning appears
   ├─→ Red/orange animated alert box
   └─→ "🔓 Reveal Borrower Identity" button shown
   
3. LENDER CLICKS REVEAL BUTTON
   │
   ├─→ Backend checks application status
   ├─→ Verifies deadline has passed
   ├─→ Calculates days overdue
   └─→ Proceeds to smart contract call
   
4. SMART CONTRACT EXECUTION
   │
   ├─→ Convert loan_id to u256
   ├─→ Convert commitment to felt252
   ├─→ Call reveal_borrower_identity(loan_id, commitment)
   ├─→ Contract verifies:
   │   • Caller is the lender
   │   • Loan is approved
   │   • Deadline has passed
   └─→ Contract emits BorrowerIdentityRevealed event
   
5. IDENTITY REVEALED
   │
   ├─→ Backend fetches revealed data from contract
   ├─→ Returns:
   │   • ZK Identity (commitment hash)
   │   • Wallet address
   │   • Loan details
   └─→ Frontend displays in alert + console
   
6. LENDER SEES DETAILS
   │
   ├─→ 🔒 ZK Identity: 0x4961c7426ec28ea71c...
   ├─→ 📍 Wallet Address: 0x123...789
   ├─→ ⏰ Overdue by: X days
   ├─→ 📝 Transaction hash
   └─→ 🔗 Voyager link
```

## 🎯 Smart Contract Integration

### reveal_borrower_identity Function
```cairo
fn reveal_borrower_identity(
    ref self: ContractState,
    loan_id: u256,
    borrower_commitment: felt252
) {
    // 1. Get loan details
    // 2. Verify caller is lender
    // 3. Find application with commitment
    // 4. Verify loan is approved
    // 5. Verify deadline has passed
    // 6. Emit BorrowerIdentityRevealed event
}
```

**What Happens On-Chain:**
1. ✅ Validates loan ID exists
2. ✅ Validates caller is the loan's lender
3. ✅ Finds application with matching commitment
4. ✅ Checks application status = "approved"
5. ✅ Checks current time > repayment deadline
6. ✅ Emits event with:
   - Loan ID
   - Lender address
   - Borrower commitment
   - Borrower wallet address
   - Days overdue

## 📊 Backend API Endpoints Used

### 1. Check Application Status
```
GET /api/loan/application/:loanId/:borrowerCommitment
```

**Response:**
```json
{
  "borrowerCommitment": "0x4961c7426ec28ea71c...",
  "status": "approved",
  "approvedAt": "2025-10-15T16:50:00.000Z",
  "repaymentDeadline": "2025-10-15T16:55:00.000Z",
  "borrower": "0x123...789"
}
```

### 2. Get Revealed Identity
```
GET /api/loan/:loanId/reveal/:borrowerCommitment
```

**Response:**
```json
{
  "commitment": "0x4961c7426ec28ea71c...",
  "borrower": "0x123...789",
  "loanId": "29",
  "revealedAt": "2025-10-15T17:00:00.000Z"
}
```

## 🔐 What Gets Revealed

### ZK Identity (Commitment)
- **What**: Hash of borrower's wallet + salt
- **Format**: `0x4961c7426ec28ea71c5dcc726...`
- **Purpose**: Permanent identity for reputation tracking
- **Privacy**: Can be used across loans without exposing wallet directly

### Wallet Address
- **What**: Borrower's actual StarkNet wallet address
- **Format**: `0x123...789` (full address)
- **Purpose**: Allows lender to contact or take action
- **Privacy**: Only revealed after deadline breach

### Why Both?
1. **Commitment**: For reputation system
   - Borrowers build credit with this identity
   - Can be checked before approving future loans
   - Doesn't expose wallet until needed

2. **Wallet Address**: For enforcement
   - Contact borrower directly
   - Pursue legal action if needed
   - Blacklist from future loans

## 🚨 User Experience

### When Loan Becomes Overdue

**Visual Changes:**
1. Application card border changes to red
2. Status badge changes to "⚠️ OVERDUE"
3. Red/orange gradient warning box appears
4. "Reveal Identity" button shows

**User Actions:**
1. Click "🔓 Reveal Borrower Identity"
2. Wallet popup: "Approve transaction"
3. Toast: "Waiting for blockchain confirmation..."
4. Alert popup with full details
5. Console logs transaction hash
6. Application UI updates

### Success Message
```
🔓 Borrower Identity Revealed!

🔒 ZK Identity (Commitment): 0x4961c7426ec28ea71c...5dcc726
📍 Wallet Address: 0x0123456789abcdef...
📋 Loan ID: 29
⏰ Overdue by: 2 days
📝 Transaction: 0x7b8f9cd...

⚠️ The borrower failed to repay within the deadline.
✅ Identity revealed on-chain via smart contract.
💡 The ZK Identity Commitment is the borrower's permanent identity used for reputation tracking.
```

## 🛡️ Security Features

### Smart Contract Validations
- ✅ Only lender can reveal identity
- ✅ Loan must be approved (not pending)
- ✅ Deadline must have passed
- ✅ Application must exist

### Frontend Validations
- ✅ Check application exists in backend
- ✅ Verify status = "approved"
- ✅ Calculate time difference
- ✅ Prevent reveal before deadline
- ✅ Show user-friendly error messages

### Privacy Protections
- ✅ Identity only revealed AFTER deadline breach
- ✅ No reveal for pending/repaid loans
- ✅ ZK commitment used for reputation tracking
- ✅ Wallet address only shown when necessary

## 📱 Testing Instructions

### Test Case 1: Successful Identity Reveal
1. ✅ Create a loan as lender
2. ✅ Borrower applies and gets approved
3. ✅ Set short repayment period (e.g., 2 minutes)
4. ✅ Wait for deadline to pass
5. ✅ Refresh applications view
6. ✅ Verify "OVERDUE" status shows
7. ✅ Click "Reveal Borrower Identity"
8. ✅ Approve transaction in wallet
9. ✅ Verify alert shows both commitment and wallet
10. ✅ Check console for transaction hash
11. ✅ Verify on Voyager

### Test Case 2: Premature Reveal Attempt
1. ❌ Try to reveal before deadline
2. ✅ Should show error: "Loan is not overdue yet"

### Test Case 3: Wrong Status
1. ❌ Try to reveal pending application
2. ✅ Should show error: "Loan must be approved"

### Test Case 4: Already Repaid
1. ❌ Try to reveal repaid loan
2. ✅ Should not show reveal button (status = "repaid")

## 🔗 Related Files

**Frontend:**
- `c:\Users\USER\Loanzy\real_frontend\app\lenders\page.tsx` (modified)

**Backend API:**
- `/api/loan/application/:loanId/:borrowerCommitment` (existing)
- `/api/loan/:loanId/reveal/:borrowerCommitment` (existing)

**Smart Contract:**
- `LoanEscrowZK::reveal_borrower_identity(loan_id, borrower_commitment)` (existing)

**Reference:**
- `c:\Users\USER\Loanzy\frontend\src\pages\LoanLenderFlow.jsx` (test frontend)

## 🎨 UI Components Used

- `Button` from Shadcn UI
- Toast notifications (react-hot-toast)
- Alert dialogs (native)
- Console logging
- Badge component (status display)

## 📝 Console Output Example

```javascript
🔓 Revealing borrower identity for overdue loan: 29
🔓 Calling reveal_borrower_identity on contract...
  Loan ID: 29
  Commitment: 0x4961c7426ec28ea71c5dcc726...
  Days Overdue: 2
⏳ Waiting for reveal tx: 0x7b8f9cd4ffa0e7e...
✅ Identity revealed on blockchain!
📋 Revealed Identity Details:
  ZK Identity (Commitment): 0x4961c7426ec28ea71c5dcc726...
  Wallet Address: 0x0123456789abcdef...
  Days Overdue: 2
  Transaction: 0x7b8f9cd4ffa0e7e...
🔗 View on Voyager: https://sepolia.voyager.online/tx/0x7b8f9cd4...
```

## ✅ Summary

**Added Features:**
1. ✅ `revealBorrowerIdentity()` function (165 lines)
2. ✅ "Reveal Identity" button in overdue warnings
3. ✅ Complete validation and error handling
4. ✅ Toast notifications for user feedback
5. ✅ Detailed alert with all identity information
6. ✅ Console logging for debugging
7. ✅ Voyager transaction links

**Integration Points:**
- ✅ Smart contract: `reveal_borrower_identity` entrypoint
- ✅ Backend API: Application status + revealed data
- ✅ Frontend UI: Overdue warning section
- ✅ Wallet: Transaction signing

**User Benefits:**
- 🔒 Privacy preserved until deadline breach
- ⚠️ Clear visual indicators for overdue loans
- 🔓 One-click identity reveal
- 📊 Complete borrower information displayed
- 🔗 On-chain proof of identity reveal

The lender can now reveal borrower identities for overdue loans, maintaining accountability while respecting privacy! 🎉
