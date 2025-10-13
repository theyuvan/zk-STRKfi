# 🎯 Complete Frontend-Backend Field Mapping Guide

## 📊 Backend Response Formats

### Endpoint: `GET /api/loan/lender/:address`
**Returns:** `{ loans: [...] }` (object with loans property)

### Endpoint: `GET /api/loan/available`
**Returns:** `[...]` (plain array)

### Endpoint: `GET /api/loan/borrower/:commitment/applications`
**Returns:** `{ applications: [...] }` (object with applications property)

### Endpoint: `GET /api/loan/borrower/:commitment/active`
**Returns:** `{ loans: [...] }` (object with loans property)

---

## 🗺️ Complete Field Mapping

### Loan Object Structure (from backend)

```javascript
{
  id: "30",                              // Loan ID (string)
  lender: "0x5b3c...",                   // Lender's wallet address
  amountPerBorrower: "50000000000000000000",  // Amount in wei (18 decimals)
  totalSlots: 1,                         // Maximum number of borrowers
  filledSlots: 0,                        // Number of approved borrowers
  slotsRemaining: 1,                     // Available slots (calculated)
  interestRate: "500",                   // Interest rate in basis points (bps)
  repaymentPeriod: "598",                // Repayment period in seconds
  minActivityScore: "100",               // Minimum activity score required
  status: "active",                      // Loan status: "active" | "funded" | "cancelled"
  createdAt: "2025-10-13T09:49:32.000Z"  // ISO 8601 timestamp
}
```

---

## 🎨 Frontend Display Conversions

### 1. STRK Amount (wei → STRK)
```javascript
// Backend: "50000000000000000000" (wei)
// Display: "50.00 STRK"

const strkAmount = (parseFloat(loan.amountPerBorrower) / 1e18).toFixed(2);
```

**Why 1e18?**
- 1 STRK = 10^18 wei (same as Ethereum's wei to ETH)
- Smart contracts use wei for precision

### 2. Interest Rate (bps → %)
```javascript
// Backend: "500" (basis points)
// Display: "5.00%"

const percentage = (parseFloat(loan.interestRate) / 100).toFixed(2);
```

**Why 100?**
- 1% = 100 basis points (bps)
- 500 bps = 5.00%
- 1250 bps = 12.50%

### 3. Repayment Period (seconds → minutes)
```javascript
// Backend: "598" (seconds)
// Display: "9min"

const minutes = Math.floor(loan.repaymentPeriod / 60);
```

**Alternative (seconds → hours):**
```javascript
const hours = Math.floor(loan.repaymentPeriod / 3600);
```

### 4. Repayment Amount Calculation
```javascript
// Calculate repayment with interest
const principal = parseFloat(loan.amountPerBorrower) / 1e18;  // STRK
const rate = parseFloat(loan.interestRate) / 10000;           // Decimal (0.05 for 5%)
const repayment = (principal * (1 + rate)).toFixed(2);        // STRK

// Example: 50 STRK at 5% = 50 × 1.05 = 52.50 STRK
```

**⚠️ CRITICAL:** Use `/10000` not `/100` for interest calculation!

### 5. Created Date (ISO → Local)
```javascript
// Backend: "2025-10-13T09:49:32.000Z" (UTC)
// Display: "10/13/2025, 5:49:32 PM" (Local)

const localTime = new Date(loan.createdAt).toLocaleString();
```

**Alternative formats:**
```javascript
// Date only
const dateOnly = new Date(loan.createdAt).toLocaleDateString();

// Time only
const timeOnly = new Date(loan.createdAt).toLocaleTimeString();

// Relative time (requires library like date-fns)
import { formatDistanceToNow } from 'date-fns';
const relativeTime = formatDistanceToNow(new Date(loan.createdAt), { addSuffix: true });
// "2 hours ago"
```

---

## 📋 Complete Component Templates

### Lender Loan Card
```jsx
{myLoans.map((loan, idx) => (
  <div key={idx} className="loan-card">
    <div className="loan-header">
      <h3>Loan #{loan.id}</h3>
      <span className={`status-badge ${loan.status}`}>
        {loan.status}
      </span>
    </div>
    
    <div className="loan-details">
      {/* Amount with conversion */}
      <div className="detail-row">
        <span>💰 Amount per Borrower:</span>
        <strong>{(parseFloat(loan.amountPerBorrower) / 1e18).toFixed(2)} STRK</strong>
      </div>
      
      {/* Slots (no conversion needed) */}
      <div className="detail-row">
        <span>👥 Slots:</span>
        <strong>{loan.filledSlots}/{loan.totalSlots}</strong>
      </div>
      
      {/* Interest rate with conversion */}
      <div className="detail-row">
        <span>📈 Interest:</span>
        <strong>{(parseFloat(loan.interestRate) / 100).toFixed(2)}%</strong>
      </div>
      
      {/* Repayment period with conversion */}
      <div className="detail-row">
        <span>⏰ Repayment Period:</span>
        <strong>{Math.floor(loan.repaymentPeriod / 60)}min</strong>
      </div>
      
      {/* Min score (no conversion needed) */}
      <div className="detail-row">
        <span>📊 Min Score:</span>
        <strong>{loan.minActivityScore}</strong>
      </div>
      
      {/* Created date with conversion */}
      <div className="detail-row">
        <span>🕐 Created:</span>
        <strong>{new Date(loan.createdAt).toLocaleString()}</strong>
      </div>
    </div>

    <button onClick={() => loadApplications(loan.id)}>
      👀 View Applications ({loan.filledSlots} pending)
    </button>
  </div>
))}
```

### Borrower Loan Card
```jsx
{availableLoans.map((loan, idx) => (
  <div key={idx} className="loan-card">
    <div className="loan-header">
      <h3>🏦 Loan #{loan.id}</h3>
      <span className="status-badge funded">AVAILABLE</span>
    </div>
    
    <div className="loan-details">
      {/* Amount with conversion */}
      <div className="detail-row">
        <span>💰 Amount per Borrower:</span>
        <strong>{(parseFloat(loan.amountPerBorrower) / 1e18).toFixed(2)} STRK</strong>
      </div>
      
      {/* Interest rate with conversion */}
      <div className="detail-row">
        <span>📈 Interest:</span>
        <strong>{(parseFloat(loan.interestRate) / 100).toFixed(2)}%</strong>
      </div>
      
      {/* Repayment period with conversion */}
      <div className="detail-row">
        <span>⏰ Repayment Period:</span>
        <strong>{Math.floor(loan.repaymentPeriod / 60)}min</strong>
      </div>
      
      {/* Slots remaining (no conversion) */}
      <div className="detail-row">
        <span>👥 Slots Available:</span>
        <strong>{loan.slotsRemaining}/{loan.totalSlots}</strong>
      </div>
      
      {/* Min score (no conversion) */}
      <div className="detail-row">
        <span>📊 Min Activity Score:</span>
        <strong>{loan.minActivityScore}</strong>
      </div>
    </div>

    {/* Repayment calculation */}
    <div className="repayment-calc">
      <p>💸 You'll repay: <strong>{
        ((parseFloat(loan.amountPerBorrower) / 1e18) * (1 + parseFloat(loan.interestRate) / 10000)).toFixed(2)
      } STRK</strong></p>
    </div>

    <button 
      onClick={() => setSelectedLoan(loan)}
      disabled={loan.slotsRemaining === 0}
    >
      {loan.slotsRemaining === 0 ? '❌ No Slots' : '📝 Apply for Loan'}
    </button>
  </div>
))}
```

---

## 🔧 Data Loading Functions

### Lender: Load My Loans
```javascript
const loadMyLoans = async () => {
  try {
    console.log('📋 Loading my loans...');
    const response = await axios.get(`http://localhost:3000/api/loan/lender/${walletAddress}`);
    const loans = response.data.loans || [];  // ← Returns {loans: [...]}
    console.log('✅ Loaded loans:', loans.length);
    console.log('📦 Loan details:', loans);
    setMyLoans(loans);
  } catch (error) {
    console.error('❌ Failed to load loans:', error);
    setMyLoans([]);
  }
};
```

### Borrower: Load Available Loans
```javascript
const loadAvailableLoans = async () => {
  try {
    console.log('📋 Loading available loans...');
    const response = await axios.get('http://localhost:3000/api/loan/available');
    // Backend returns plain array, not {loans: [...]}
    const loans = Array.isArray(response.data) ? response.data : (response.data.loans || []);
    console.log('✅ Loaded loans:', loans.length);
    console.log('📦 Loan details:', loans);
    setAvailableLoans(loans);
  } catch (error) {
    console.error('❌ Failed to load loans:', error);
    setAvailableLoans([]);
  }
};
```

---

## 🧮 Conversion Formulas Quick Reference

| Conversion | Formula | Example |
|-----------|---------|---------|
| **wei → STRK** | `value / 1e18` | 50000000000000000000 / 1e18 = 50.00 |
| **STRK → wei** | `value * 1e18` | 50 * 1e18 = 50000000000000000000 |
| **bps → %** | `value / 100` | 500 / 100 = 5.00 |
| **% → bps** | `value * 100` | 5 * 100 = 500 |
| **sec → min** | `Math.floor(value / 60)` | Math.floor(598 / 60) = 9 |
| **sec → hours** | `Math.floor(value / 3600)` | Math.floor(7200 / 3600) = 2 |
| **Interest (decimal)** | `bps / 10000` | 500 / 10000 = 0.05 |
| **Repayment** | `amount × (1 + rate/10000)` | 50 × (1 + 500/10000) = 52.50 |
| **ISO → Local** | `new Date(value).toLocaleString()` | "10/13/2025, 5:49:32 PM" |

---

## ⚠️ Common Mistakes to Avoid

### ❌ Mistake 1: Wrong Interest Calculation
```javascript
// WRONG - treats bps as percentage
const repayment = amount * (1 + interestRate / 100);
// 50 × (1 + 500/100) = 50 × 6 = 300 STRK ❌

// CORRECT - converts bps to decimal
const repayment = amount * (1 + interestRate / 10000);
// 50 × (1 + 500/10000) = 50 × 1.05 = 52.50 STRK ✅
```

### ❌ Mistake 2: Forgetting Wei Conversion
```javascript
// WRONG - displays wei
<strong>{loan.amountPerBorrower} STRK</strong>
// Shows: "50000000000000000000 STRK" ❌

// CORRECT - converts to STRK
<strong>{(parseFloat(loan.amountPerBorrower) / 1e18).toFixed(2)} STRK</strong>
// Shows: "50.00 STRK" ✅
```

### ❌ Mistake 3: Wrong Response Format
```javascript
// WRONG - assumes wrong format
setAvailableLoans(response.data.loans || []);
// Works for lender endpoint, fails for available endpoint ❌

// CORRECT - handles both formats
const loans = Array.isArray(response.data) ? response.data : (response.data.loans || []);
setAvailableLoans(loans);
// Works for all endpoints ✅
```

### ❌ Mistake 4: Missing BigInt Conversion
```javascript
// WRONG - JavaScript loses precision for large numbers
const amount = 50 * 1e18;  // May lose precision

// CORRECT - use BigInt for wei amounts
const amount = BigInt(Math.floor(50 * 1e18));
```

---

## 🎯 Validation Checklist

### Data Loading ✅
- [ ] Response format handled correctly (array vs object)
- [ ] Console logs show correct loan count
- [ ] Console logs show loan details for debugging

### Display Conversions ✅
- [ ] Amounts show in STRK (not wei or scientific notation)
- [ ] Interest rates show in % (not bps)
- [ ] Periods show in min or hours (not seconds)
- [ ] Dates show in local time (not UTC)

### Calculations ✅
- [ ] Repayment calculation uses `/10000` for interest
- [ ] Total amounts calculated correctly
- [ ] No "NaN" or "undefined" values

### User Experience ✅
- [ ] All numbers formatted with 2 decimals
- [ ] All dates in readable format
- [ ] Button states correct (disabled when no slots)
- [ ] No console errors

---

## 📚 Additional Resources

### StarkNet Unit Conversions
- **1 STRK = 10^18 wei** (same as Ethereum)
- **1 gwei = 10^9 wei**
- **1 milli-STRK = 10^15 wei**

### Interest Rate Formats
- **Basis Points (bps):** 1 bps = 0.01%
- **500 bps = 5%**
- **1250 bps = 12.5%**
- **10000 bps = 100%**

### Time Conversions
- **1 minute = 60 seconds**
- **1 hour = 3600 seconds**
- **1 day = 86400 seconds**
- **1 week = 604800 seconds**

---

## 🎉 Summary

This guide provides complete field mapping between backend responses and frontend display, including all necessary conversions for:
- ✅ STRK amounts (wei ↔ STRK)
- ✅ Interest rates (bps ↔ %)
- ✅ Time periods (seconds ↔ min/hours)
- ✅ Repayment calculations
- ✅ Dates (ISO ↔ Local)

Use these templates and formulas to ensure consistent data handling across your entire application!
