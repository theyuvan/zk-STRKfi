const { RpcProvider, uint256 } = require('starknet');

const LOAN_ESCROW_ZK_ADDRESS = '0x0731fa59e1da780c1585de660415f627c2c66c4b42b8849805e68a2eaaca79d8';
const RPC_URL = 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7';
const COMMITMENT = '0x22083c8b84ffd614c26468f2ada0c1baad4df98d81a0e1d7d757beb0155dd2d';

async function checkNewContractLoans() {
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  
  console.log('🔍 Checking NEW contract for active loans...');
  console.log('Contract:', LOAN_ESCROW_ZK_ADDRESS);
  console.log('Commitment:', COMMITMENT);
  console.log('');
  
  try {
    // Get loan count
    const countResult = await provider.callContract({
      contractAddress: LOAN_ESCROW_ZK_ADDRESS,
      entrypoint: 'get_loan_count',
      calldata: []
    });
    
    const loanCount = Number(countResult.result[0]);
    console.log(`📊 Total loans on NEW contract: ${loanCount}\n`);
    
    if (loanCount === 0) {
      console.log('❌ No loans found on new contract!');
      console.log('💡 Make sure you created the loan on the NEW contract address.');
      return;
    }
    
    // Check each loan
    for (let loanId = 1; loanId <= loanCount; loanId++) {
      console.log(`\n🔍 Checking Loan #${loanId}...`);
      
      const { low: loanLow, high: loanHigh } = uint256.bnToUint256(BigInt(loanId));
      
      // Get loan details
      const loanResult = await provider.callContract({
        contractAddress: LOAN_ESCROW_ZK_ADDRESS,
        entrypoint: 'get_loan_details',
        calldata: [loanLow.toString(), loanHigh.toString()]
      });
      
      const lender = loanResult.result[0];
      const amountLow = BigInt(loanResult.result[1]);
      const amountHigh = BigInt(loanResult.result[2]);
      const totalSlots = Number(loanResult.result[3]);
      const filledSlots = Number(loanResult.result[4]);
      const interestLow = BigInt(loanResult.result[5]);
      const interestHigh = BigInt(loanResult.result[6]);
      const repaymentPeriod = BigInt(loanResult.result[7]);
      const status = Number(loanResult.result[10]);
      
      const amount = (amountLow + (amountHigh << 128n)) / BigInt(1e18);
      const interest = (interestLow + (interestHigh << 128n));
      
      console.log(`  Lender: ${lender}`);
      console.log(`  Amount: ${amount} STRK`);
      console.log(`  Slots: ${filledSlots}/${totalSlots}`);
      console.log(`  Status: ${status} ${status === 0 ? '(active)' : status === 1 ? '(funded)' : '(cancelled)'}`);
      console.log(`  Repayment Period: ${repaymentPeriod} seconds`);
      console.log(`  Interest: ${Number(interest) / 100}%`);
      
      // Check application for this loan with the commitment
      try {
        const appResult = await provider.callContract({
          contractAddress: LOAN_ESCROW_ZK_ADDRESS,
          entrypoint: 'get_application',
          calldata: [loanLow.toString(), loanHigh.toString(), COMMITMENT]
        });
        
        const borrower = appResult.result[0];
        const appStatus = Number(appResult.result[3]);
        const approvedAt = Number(appResult.result[5]);
        const repaymentDeadline = Number(appResult.result[7]);
        
        if (borrower === '0x0') {
          console.log(`  ❌ No application found for this commitment`);
        } else {
          console.log(`\n  ✅ APPLICATION FOUND!`);
          console.log(`  Borrower: ${borrower}`);
          console.log(`  Status: ${appStatus} ${appStatus === 0 ? '(pending)' : appStatus === 1 ? '(approved)' : '(repaid)'}`);
          
          if (appStatus === 1) {
            console.log(`  ✅ APPROVED!`);
            console.log(`  Approved At: ${approvedAt > 0 ? new Date(approvedAt * 1000).toISOString() : 'N/A'}`);
            console.log(`  Repayment Deadline: ${repaymentDeadline > 0 ? new Date(repaymentDeadline * 1000).toISOString() : '❌ NOT SET (BUG!)'}`);
            
            if (repaymentDeadline === 0) {
              console.log(`  ⚠️ WARNING: Deadline is 0! Check if repayment_period was set when creating loan.`);
            }
          }
        }
      } catch (appError) {
        console.log(`  ℹ️ No application for this commitment`);
      }
    }
    
    console.log('\n\n📊 SUMMARY:');
    console.log(`Total loans: ${loanCount}`);
    console.log(`\nTo see active loans on borrower page:`);
    console.log(`1. Backend must query: ${LOAN_ESCROW_ZK_ADDRESS}`);
    console.log(`2. Commitment must match: ${COMMITMENT}`);
    console.log(`3. Application status must be 1 (approved)`);
    console.log(`4. Borrower address must not be 0x0`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkNewContractLoans().catch(console.error);
