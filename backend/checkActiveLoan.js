const { RpcProvider, uint256 } = require('starknet');

const LOAN_ESCROW_ZK_ADDRESS = '0x06b058a0946bb36fa846e6a954da885fa20809f43a9e47038dc83b4041f7f012';
const RPC_URL = 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7';

const provider = new RpcProvider({ nodeUrl: RPC_URL });

async function checkAllLoansForCommitment(commitment) {
  console.log(`\n🔍 Scanning ALL loans for commitment: ${commitment.slice(0, 20)}...`);
  console.log(`📍 Using RPC: ${RPC_URL}`);
  console.log(`📍 Contract: ${LOAN_ESCROW_ZK_ADDRESS}\n`);
  
  try {
    // Get total loan count
    const loanCountResult = await provider.callContract({
      contractAddress: LOAN_ESCROW_ZK_ADDRESS,
      entrypoint: 'get_loan_count',
      calldata: []
    });
    
    const loanCount = Number(loanCountResult.result[0]);
    console.log(`📊 Total loans on-chain: ${loanCount}\n`);
    
    const activeLoans = [];
    
    // Scan all loans
    for (let i = 1; i <= loanCount; i++) {
      try {
        const { low, high } = uint256.bnToUint256(BigInt(i));
        
        const result = await provider.callContract({
          contractAddress: LOAN_ESCROW_ZK_ADDRESS,
          entrypoint: 'get_application',
          calldata: [low, high, commitment]
        });
        
        const app = {
          borrower: result.result[0],
          commitment: result.result[1],
          proof_hash: result.result[2],
          status: Number(result.result[3]),
          applied_at: Number(result.result[4]),
          approved_at: Number(result.result[5]),
          repayment_deadline: Number(result.result[6])
        };
        
        // Only log if application exists
        if (app.borrower !== '0x0') {
          const statusText = app.status === 0 ? '⏳ PENDING' : app.status === 1 ? '✅ APPROVED' : '💰 REPAID';
          
          console.log(`Loan #${i}: ${statusText}`);
          console.log(`  Borrower: ${app.borrower}`);
          console.log(`  Applied: ${new Date(app.applied_at * 1000).toISOString()}`);
          
          if (app.status === 1) {
            console.log(`  Approved: ${new Date(app.approved_at * 1000).toISOString()}`);
            console.log(`  Deadline: ${new Date(app.repayment_deadline * 1000).toISOString()}`);
            
            // Get loan details for approved loans
            const loanResult = await provider.callContract({
              contractAddress: LOAN_ESCROW_ZK_ADDRESS,
              entrypoint: 'get_loan_details',
              calldata: [low, high]
            });
            
            const amount = uint256.uint256ToBN({ low: loanResult.result[1], high: loanResult.result[2] });
            const interestRate = uint256.uint256ToBN({ low: loanResult.result[5], high: loanResult.result[6] });
            
            console.log(`  Amount: ${(Number(amount) / 1e18).toFixed(4)} STRK`);
            console.log(`  Interest: ${(Number(interestRate) / 100).toFixed(2)}%`);
            
            activeLoans.push({
              loanId: i,
              borrower: app.borrower,
              amount: amount.toString(),
              interestRate: interestRate.toString(),
              approvedAt: new Date(app.approved_at * 1000).toISOString(),
              repaymentDeadline: new Date(app.repayment_deadline * 1000).toISOString()
            });
          }
          console.log('');
        }
      } catch (err) {
        // Silent fail for non-existent applications
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`📊 SUMMARY:`);
    console.log(`   Total approved loans: ${activeLoans.length}`);
    
    if (activeLoans.length === 0) {
      console.log('\n❌ No approved loans found for this commitment!');
      console.log('\nPossible reasons:');
      console.log('  1. Loan not yet approved by lender');
      console.log('  2. Commitment mismatch (check localStorage value)');
      console.log('  3. Application not submitted on-chain');
    } else {
      console.log('\n✅ APPROVED LOANS (should appear in frontend):');
      activeLoans.forEach(loan => {
        console.log(`\n  Loan #${loan.loanId}:`);
        console.log(`    Amount: ${(Number(loan.amount) / 1e18).toFixed(4)} STRK`);
        console.log(`    Deadline: ${loan.repaymentDeadline}`);
      });
    }
    console.log('='.repeat(60) + '\n');
    
    return activeLoans;
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  }
}

// Get commitment from command line or use default test commitment
const commitment = process.argv[2] || '0x22083c8b84ffd614c26468f2ada0c1baad4df98d81a0e1d7d757beb0155dd2d';

checkAllLoansForCommitment(commitment)
  .then(loans => {
    console.log(`\n✅ Check complete! Found ${loans.length} active loan(s)\n`);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
