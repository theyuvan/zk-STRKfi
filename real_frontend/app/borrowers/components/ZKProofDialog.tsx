import { useState } from 'react'
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

interface ZKProofDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loanAmount: number
}

export default function ZKProofDialog({ open, onOpenChange, loanAmount }: ZKProofDialogProps) {
  const [isSubmittingProof, setIsSubmittingProof] = useState(false)
  const [loanApproved, setLoanApproved] = useState(false)

  const handleSubmitZkProof = () => {
    setIsSubmittingProof(true)
    setTimeout(() => {
      setIsSubmittingProof(false)
      setLoanApproved(true)
      setTimeout(() => {
        onOpenChange(false)
        setTimeout(() => {
          setLoanApproved(false)
        }, 500)
      }, 2000)
    }, 3000)
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
                  <p className="text-white/80 font-semibold">Verifying ZK Proof...</p>
                  <p className="text-sm text-white/60 mt-2">This may take a few moments</p>
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
                    <p className="text-xs text-white/60 mb-2">Proof Hash (Mock)</p>
                    <p className="text-xs font-mono text-purple-400 break-all">
                      0x7f9fade1c0d57a7af66ab4ead79fade1c0d57a7af66ab4ead7c2c2eb7b11a91385
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
              <p className="text-xs text-white/60">
                Transaction hash: 0x7f9fade...91385
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
