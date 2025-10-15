import { useState, useEffect } from 'react'
import { Shield, Zap, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'
import { proofApi, loanApi } from '@/lib/services/api'
import { StarkNetService } from '@/lib/services/starknet'
import toast from 'react-hot-toast'

interface ZKProofDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loanAmount: number
  selectedLoan?: any
  walletAddress?: string
}

export default function ZKProofDialog({ 
  open, 
  onOpenChange, 
  loanAmount,
  selectedLoan,
  walletAddress 
}: ZKProofDialogProps) {
  const [isSubmittingProof, setIsSubmittingProof] = useState(false)
  const [loanApproved, setLoanApproved] = useState(false)
  const [proofData, setProofData] = useState<any>(null)
  const [transactionHash, setTransactionHash] = useState<string>('')

  useEffect(() => {
    if (open && !proofData) {
      generateProof()
    }
  }, [open])

  const generateProof = async () => {
    if (!walletAddress) {
      toast.error('No wallet connected')
      return
    }

    try {
      console.log('🔐 Generating ZK proof...')
      
      // Generate proof with mock salary data for now
      // TODO: Replace with actual user data when available
      const salary = 50000 // Mock salary for proof generation
      const threshold = 30000 // Required threshold
      const salt = Math.random().toString(36).substring(7) // Random salt
      
      const proof = await proofApi.generateProof(salary, threshold, salt)
      console.log('✅ Proof generated:', proof)
      setProofData(proof)
    } catch (error) {
      console.error('❌ Failed to generate proof:', error)
      toast.error('Failed to generate ZK proof')
    }
  }

  const handleSubmitZkProof = async () => {
    if (!walletAddress || !selectedLoan || !proofData) {
      toast.error('Missing required data')
      return
    }

    setIsSubmittingProof(true)

    try {
      console.log('📝 Applying for loan...', {
        loanId: selectedLoan.loanId,
        borrower: walletAddress,
        proof: proofData
      })

      // Get wallet connection
      const starknet = (window as any).starknet
      if (!starknet?.isConnected) {
        throw new Error('Wallet not connected')
      }

      // Prepare the transaction
      const starknetService = new StarkNetService()
      const txCall = starknetService.prepareApplyForLoan(
        selectedLoan.loanId,
        proofData.identityCommitment || proofData.commitment,
        proofData.proofHash,
        proofData.activityScore || 750
      )

      // Execute transaction through wallet
      console.log('🔄 Executing transaction through wallet...')
      const result = await starknet.account.execute([txCall])
      
      console.log('✅ Transaction sent:', result.transaction_hash)
      setTransactionHash(result.transaction_hash)
      setIsSubmittingProof(false)
      setLoanApproved(true)

      toast.success('Loan approved and transferred!')

      setTimeout(() => {
        onOpenChange(false)
        setTimeout(() => {
          setLoanApproved(false)
          setProofData(null)
        }, 500)
      }, 3000)
    } catch (error) {
      console.error('❌ Failed to apply for loan:', error)
      setIsSubmittingProof(false)
      toast.error(error instanceof Error ? error.message : 'Failed to apply for loan')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white max-w-md">
        {!loanApproved ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-purple-400">
                <Shield className="w-5 h-5" />
                Zero-Knowledge Proof Verification
              </DialogTitle>
              <DialogDescription className="text-white/70">
                Submitting your ZK proof to verify eligibility without revealing personal data
              </DialogDescription>
            </DialogHeader>
            
            <div className="mt-4 space-y-4">
              {isSubmittingProof ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-white/80 font-semibold">Verifying ZK Proof on-chain...</p>
                  <p className="text-sm text-white/60 mt-2">Please confirm transaction in wallet</p>
                </div>
              ) : !proofData ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-white/80 font-semibold">Generating ZK Proof...</p>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <p className="text-xs text-purple-400 mb-3 flex items-center gap-2">
                      <Shield className="w-3 h-3" />
                      Your ZK Proof Contains:
                    </p>
                    <ul className="text-xs text-white/70 space-y-1 ml-5">
                      <li>✓ Eligibility score verification</li>
                      <li>✓ Wallet balance proof</li>
                      <li>✓ Transaction history proof</li>
                      <li>✓ Account age verification</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-lg bg-neutral-800/50 border border-white/10">
                    <p className="text-xs text-white/60 mb-2">Proof Hash</p>
                    <p className="text-xs font-mono text-purple-400 break-all">
                      {proofData.proofHash || 'Generating...'}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-neutral-800/50 border border-white/10">
                    <p className="text-xs text-white/60 mb-2">Identity Commitment</p>
                    <p className="text-xs font-mono text-purple-400 break-all">
                      {proofData.identityCommitment || 'N/A'}
                    </p>
                  </div>

                  <Button
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    onClick={handleSubmitZkProof}
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Submit Proof & Request Loan
                  </Button>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h3 className="text-2xl font-bold text-green-400 mb-2">Loan Approved! 🎉</h3>
            <p className="text-white/70 mb-4">
              Your ZK proof has been verified successfully
            </p>
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <p className="text-sm text-green-400 font-semibold mb-2">
                {formatCurrency(loanAmount)} transferred to your wallet
              </p>
              {transactionHash && (
                <p className="text-xs text-white/60 break-all">
                  Transaction hash: {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
