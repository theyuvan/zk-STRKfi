const axios = require('axios');

const BACKEND_URL = 'http://localhost:3000';
const commitment = '0x22083c8b84ffd614c26468f2ada0c1baad4df98d81a0e1d7d757beb0155dd2d';

async function testActiveLoansEndpoint() {
  console.log('\n🧪 Testing backend /borrower/:commitment/active endpoint');
  console.log(`📍 URL: ${BACKEND_URL}/api/loan/borrower/${commitment.slice(0, 20)}...active`);
  console.log('');
  
  try {
    const response = await axios.get(
      `${BACKEND_URL}/api/loan/borrower/${commitment}/active`
    );
    
    console.log('✅ Response received!');
    console.log('\n📦 Response data:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.loans) {
      console.log(`\n✅ Found ${response.data.loans.length} loans in response`);
      
      if (response.data.loans.length === 0) {
        console.log('\n❌ PROBLEM: Backend returned 0 loans but we know 3 exist!');
        console.log('\nPossible causes:');
        console.log('  1. Backend is filtering them out (check status check)');
        console.log('  2. Commitment mismatch in backend query');
        console.log('  3. Backend error in parsing application data');
      } else {
        console.log('\n✅ Loans returned by backend:');
        let i = 0;
        for (const loan of response.data.loans) {
          i++;
          console.log(`\n  Loan ${i}:`);
          console.log(`    ID: ${loan.loanId}`);
          console.log(`    Amount: ${(Number(loan.amount) / 1e18).toFixed(4)} STRK`);
          console.log(`    Status: ${loan.status}`);
          console.log(`    Deadline: ${loan.repaymentDeadline}`);
        }
      }
    } else if (Array.isArray(response.data)) {
      console.log(`\n⚠️ Response is an array (old format), length: ${response.data.length}`);
      console.log('\n❌ PROBLEM: Frontend expects response.data.loans but got array directly!');
    } else {
      console.log('\n❌ Unexpected response format!');
      console.log('Response keys:', Object.keys(response.data));
    }
    
  } catch (error) {
    console.error('\n❌ Error calling backend:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Backend is not running! Start it with: npm start');
    } else if (error.response) {
      console.log('\nBackend returned error:');
      console.log('  Status:', error.response.status);
      console.log('  Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

try {
  await testActiveLoansEndpoint();
  console.log('\n✅ Test complete\n');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
}
