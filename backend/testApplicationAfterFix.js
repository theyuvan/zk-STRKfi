const { RpcProvider, uint256 } = require('starknet');

const LOAN_ESCROW_ZK_ADDRESS = '0x0731fa59e1da780c1585de660415f627c2c66c4b42b8849805e68a2eaaca79d8';
const RPC_URL = 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7';
const COMMITMENT = '0x22083c8b84ffd614c26468f2ada0c1baad4df98d81a0e1d7d757beb0155dd2d6';

async function testApplicationAfterFix() {
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  
  console.log('🧪 Testing application endpoint after fix...\n');
  console.log('Contract:', LOAN_ESCROW_ZK_ADDRESS);
  console.log('Commitment (66 chars):', COMMITMENT);
  console.log('Commitment (65 chars):', COMMITMENT.slice(0, -1));
  
  // Get loan count
  const loanCountResult = await provider.callContract({
    contractAddress: LOAN_ESCROW_ZK_ADDRESS,
    entrypoint: 'get_loan_count',
    calldata: []
  });
  
  const loanCount = parseInt(loanCountResult.result[0], 16);
  console.log(`\n📊 Total loans: ${loanCount}\n`);
  
  // Test both commitment variants
  const commitmentVariants = [
    COMMITMENT,
    COMMITMENT.slice(0, -1)
  ];
  
  for (let loanId = 1; loanId <= loanCount; loanId++) {
    console.log(`\n🔍 Checking Loan #${loanId}...`);
    
    for (const commitment of commitmentVariants) {
      try {
        const { low, high } = uint256.bnToUint256(BigInt(loanId));
        
        const appResult = await provider.callContract({
          contractAddress: LOAN_ESCROW_ZK_ADDRESS,
          entrypoint: 'get_application',
          calldata: [low.toString(), high.toString(), commitment]
        });
        
        const borrower = appResult.result[0];
        const status = parseInt(appResult.result[3], 16);
        const approved_at = parseInt(appResult.result[5], 16);
        const repayment_deadline = parseInt(appResult.result[7], 16);
        
        if (borrower !== '0x0') {
          console.log(`  ✅ Found application with commitment: ${commitment.slice(0, 20)}...`);
          console.log(`     Borrower: ${borrower}`);
          console.log(`     Status: ${status} ${status === 0 ? '(pending)' : status === 1 ? '(approved)' : '(repaid)'}`);
          console.log(`     Approved: ${approved_at ? new Date(approved_at * 1000).toISOString() : 'Not yet'}`);
          console.log(`     Deadline: ${repayment_deadline ? new Date(repayment_deadline * 1000).toISOString() : 'Not set'}`);
        }
      } catch (error) {
        // Silent - commitment not found
      }
    }
  }
}

testApplicationAfterFix().catch(console.error);
