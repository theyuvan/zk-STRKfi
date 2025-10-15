import Link from 'next/link'
import { ArrowLeft, ArrowRight, Shield, Wallet, FileCheck, Lock, Users, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import RevealOnView from '@/components/reveal-on-view'
import DotGridShader from '@/components/DotGridShader'

export default function HowItWorksPage() {
  return (
    <main className="bg-neutral-950 text-white min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        {/* Header */}
        <div className="mb-12">
          <Button asChild variant="ghost" className="mb-4 text-white/70 hover:text-white">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
          <RevealOnView>
            <h1 className="text-5xl font-black tracking-tight mb-4">How It Works</h1>
            <p className="text-xl text-white/70 max-w-3xl">
              Loanzy uses cutting-edge cryptography to enable privacy-preserving loans. 
              Here's how we protect your data while proving your creditworthiness.
            </p>
          </RevealOnView>
        </div>

        {/* Process Flow */}
        <div className="mb-16">
          <RevealOnView>
            <h2 className="text-3xl font-bold mb-8">The Borrowing Process</h2>
          </RevealOnView>

          <div className="space-y-6">
            <ProcessStep
              number={1}
              icon={Wallet}
              title="Connect Your Wallet"
              description="Connect your StarkNet wallet (Argent or Braavos). We analyze your on-chain transaction history to evaluate creditworthiness."
              details={[
                "No personal information required",
                "Instant wallet connection",
                "Works with any StarkNet wallet"
              ]}
              color="purple"
            />

            <ProcessStep
              number={2}
              icon={Shield}
              title="Generate Zero-Knowledge Proof"
              description="Our system creates a cryptographic proof that verifies you meet the creditworthiness criteria without revealing your exact financial data."
              details={[
                "Proves balance ≥ threshold without revealing exact amount",
                "Verifies transaction activity privately",
                "Cryptographically secure and tamper-proof"
              ]}
              color="blue"
            />

            <ProcessStep
              number={3}
              icon={FileCheck}
              title="Submit Loan Request"
              description="Submit your loan request to the StarkNet blockchain with your ZK proof attached. Lenders can verify your creditworthiness instantly."
              details={[
                "Request posted on-chain",
                "Transparent and auditable",
                "Lenders see only the proof, not your data"
              ]}
              color="cyan"
            />

            <ProcessStep
              number={4}
              icon={Zap}
              title="Get Funded"
              description="Once a lender approves your request, funds are transferred to a smart contract escrow and then released to your wallet."
              details={[
                "Instant approval and disbursement",
                "Smart contract handles escrow",
                "Automated repayment tracking"
              ]}
              color="green"
            />
          </div>
        </div>

        {/* Technology Stack */}
        <div className="mb-16">
          <RevealOnView>
            <h2 className="text-3xl font-bold mb-8">Technology Stack</h2>
          </RevealOnView>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <TechCard
              title="Zero-Knowledge Proofs"
              description="ZK-SNARKs enable you to prove statements about your financial data without revealing the data itself."
              icon={Shield}
            />
            <TechCard
              title="StarkNet"
              description="Layer 2 scaling solution on Ethereum providing fast, low-cost transactions with Cairo smart contracts."
              icon={Zap}
            />
            <TechCard
              title="IPFS"
              description="Decentralized storage for encrypted identity data, ensuring no single point of failure."
              icon={Lock}
            />
            <TechCard
              title="Shamir Secret Sharing"
              description="Your encrypted identity is split into shares distributed to trustees for recovery in case of default."
              icon={Users}
            />
            <TechCard
              title="Smart Contracts"
              description="Cairo contracts on StarkNet handle loan escrow, repayments, and default conditions automatically."
              icon={FileCheck}
            />
            <TechCard
              title="Wallet Integration"
              description="Seamless integration with Argent and Braavos wallets for easy on-chain interaction."
              icon={Wallet}
            />
          </div>
        </div>

        {/* Privacy Guarantees */}
        <div className="mb-16">
          <RevealOnView>
            <Card className="bg-neutral-900/60 border-white/10 relative overflow-hidden">
              <div className="pointer-events-none absolute inset-0 opacity-5">
                <DotGridShader />
              </div>
              <CardHeader>
                <CardTitle className="text-2xl">Privacy Guarantees</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="font-bold mb-3 text-green-500">✓ What's Protected</h3>
                    <ul className="space-y-2 text-sm text-white/70">
                      <li>• Your exact wallet balance</li>
                      <li>• Individual transaction amounts</li>
                      <li>• Transaction counterparties</li>
                      <li>• Spending patterns and history</li>
                      <li>• Personal identity (until default)</li>
                      <li>• Income details (if using payroll)</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-bold mb-3 text-blue-500">→ What's Revealed</h3>
                    <ul className="space-y-2 text-sm text-white/70">
                      <li>• Boolean: "Meets criteria" (yes/no)</li>
                      <li>• Creditworthiness score (0-100)</li>
                      <li>• Loan amount requested</li>
                      <li>• ZK proof hash (commitment)</li>
                      <li>• Wallet address (public anyway)</li>
                      <li>• Loan repayment status</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <h4 className="font-semibold mb-2 text-yellow-500">⚠️ Default Condition</h4>
                  <p className="text-sm text-white/70">
                    If you default on your loan, trustees can reconstruct your encrypted identity 
                    using Shamir Secret Sharing. This ensures accountability while maintaining 
                    privacy for honest borrowers.
                  </p>
                </div>
              </CardContent>
            </Card>
          </RevealOnView>
        </div>

        {/* CTA */}
        <RevealOnView>
          <div className="text-center py-12">
            <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-white/70 mb-6 max-w-2xl mx-auto">
              Experience the future of privacy-preserving finance. Get your loan approved 
              in minutes without compromising your financial privacy.
            </p>
            <Button asChild size="lg" className="bg-white text-black hover:bg-white/90 rounded-full">
              <Link href="/wallet-analysis">
                Start Your Application
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </RevealOnView>
      </div>
    </main>
  )
}

function ProcessStep({ 
  number, 
  icon: Icon, 
  title, 
  description, 
  details, 
  color 
}: { 
  number: number
  icon: any
  title: string
  description: string
  details: string[]
  color: string
}) {
  const colorClasses = {
    purple: 'from-purple-500 to-purple-600',
    blue: 'from-blue-500 to-blue-600',
    cyan: 'from-cyan-500 to-cyan-600',
    green: 'from-green-500 to-green-600',
  }

  return (
    <RevealOnView>
      <Card className="bg-neutral-900/60 border-white/10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-white/20 to-transparent" />
        <CardContent className="p-6">
          <div className="flex gap-6">
            <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} flex items-center justify-center text-xl font-bold`}>
              {number}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Icon className="h-5 w-5 text-white/70" />
                <h3 className="text-xl font-bold">{title}</h3>
              </div>
              <p className="text-white/70 mb-4">{description}</p>
              <ul className="space-y-1 text-sm text-white/60">
                {details.map((detail, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </RevealOnView>
  )
}

function TechCard({ title, description, icon: Icon }: { title: string, description: string, icon: any }) {
  return (
    <RevealOnView>
      <Card className="bg-neutral-900/60 border-white/10 hover:border-white/20 transition-all">
        <CardContent className="p-6">
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center mb-4">
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="font-bold mb-2">{title}</h3>
          <p className="text-sm text-white/70">{description}</p>
        </CardContent>
      </Card>
    </RevealOnView>
  )
}
