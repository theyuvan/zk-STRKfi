const { RpcProvider } = require('starknet');

const LOAN_ESCROW_ZK_ADDRESS = '0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012';
const RPC_URL = 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7';

async function checkLoanRepaymentPeriod() {
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  
  // Check loans 38, 39, 40
  const loanIds = [38, 39, 40];
  
  console.log('🔍 Checking repayment_period for approved loans...\n');
  
  for (const loanId of loanIds) {
    try {
      // Call get_loan on contract to get full loan details
      const result = await provider.callContract({
        contractAddress: LOAN_ESCROW_ZK_ADDRESS,
        entrypoint: 'get_loan',
        calldata: [loanId.toString(), '0'] // u256 (low, high)
      });
      
      // Parse loan data
      // Loan struct: lender, amount_per_borrower (u256), total_slots, filled_slots, 
      //              interest_rate_bps (u256), repayment_period, min_activity_score (u256), 
      //              status, created_at
      const lender = result[0];
      const amountLow = BigInt(result[1]);
      const amountHigh = BigInt(result[2]);
      const totalSlots = parseInt(result[3]);
      const filledSlots = parseInt(result[4]);
      const interestLow = BigInt(result[5]);
      const interestHigh = BigInt(result[6]);
      const repaymentPeriod = BigInt(result[7]); // u64
      const minScoreLow = BigInt(result[8]);
      const minScoreHigh = BigInt(result[9]);
      const status = parseInt(result[10]);
      const createdAt = BigInt(result[11]);
      
      const amount = (amountLow + (amountHigh << 128n)) / BigInt(1e18);
      const interest = (interestLow + (interestHigh << 128n));
      
      console.log(`Loan #${loanId}:`);
      console.log(`  Amount: ${amount} STRK`);
      console.log(`  Interest Rate: ${Number(interest) / 100}%`);
      console.log(`  Slots: ${filledSlots}/${totalSlots}`);
      console.log(`  Status: ${status}`);
      console.log(`  ⏰ Repayment Period: ${repaymentPeriod} seconds`);
      
      if (repaymentPeriod === 0n) {
        console.log(`  ❌ BUG CONFIRMED: repayment_period = 0!`);
      } else {
        console.log(`  ✅ Repayment period is set correctly`);
      }
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error checking loan ${loanId}:`, error.message);
    }
  }
}

checkLoanRepaymentPeriod().catch(console.error);
