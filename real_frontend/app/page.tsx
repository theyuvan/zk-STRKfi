import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import DotGridShader from "@/components/DotGridShader"
import AnimatedHeading from "@/components/animated-heading"
import RevealOnView from "@/components/reveal-on-view"
import FeatureCard from "@/components/feature-card"

export default function Page() {
  const features = [
    {
      icon: "Shield" as const,
      title: "Zero-Knowledge Proofs",
      description: "Prove your creditworthiness without revealing sensitive financial data. Your privacy is guaranteed by cryptographic proofs.",
      gradient: "from-purple-500 to-blue-500",
    },
    {
      icon: "Wallet" as const,
      title: "Wallet-Based Credit",
      description: "Get instant loan approval based on your on-chain transaction history and wallet activity on StarkNet.",
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      icon: "Lock" as const,
      title: "Encrypted Identity",
      description: "Your identity is encrypted and stored on IPFS with Shamir Secret Sharing for recovery only in case of default.",
      gradient: "from-cyan-500 to-teal-500",
    },
    {
      icon: "FileCheck" as const,
      title: "Income Verification",
      description: "Connect your payroll provider (Plaid, ADP) to verify income without sharing exact salary details.",
      gradient: "from-teal-500 to-green-500",
    },
    {
      icon: "Zap" as const,
      title: "Instant Processing",
      description: "Smart contracts on StarkNet enable instant loan approval and disbursement once proofs are verified.",
      gradient: "from-green-500 to-yellow-500",
    },
    {
      icon: "TrendingUp" as const,
      title: "Fair & Transparent",
      description: "Automated escrow and default handling ensure fair treatment for both borrowers and lenders.",
      gradient: "from-yellow-500 to-orange-500",
    },
  ]

  return (
    <main className="bg-neutral-950 text-white min-h-screen">
      {/* Hero Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="max-w-6xl mx-auto text-center">
          <RevealOnView intensity="hero">
            <div className="mb-4 flex items-center justify-center gap-2">
              <div className="h-2 w-2 rounded-full bg-purple-500" />
            </div>
            
            <AnimatedHeading
              className="text-5xl font-black leading-tight tracking-tight sm:text-6xl lg:text-7xl mb-6"
              lines={["Privacy-Preserving", "Loans on StarkNet"]}
            />

            <p className="mt-6 max-w-3xl mx-auto text-xl text-white/70 mb-8">
              Borrow money without revealing your financial secrets. Zero-knowledge proofs verify your creditworthiness while keeping your data private.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Button asChild size="lg" className="rounded-full bg-white text-black hover:bg-white/90">
                <Link href="/wallet-analysis">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full border-white/20 text-white hover:bg-white/10">
                <Link href="/how-it-works">
                  Learn More
                </Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="mt-16 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
              <div>
                <div className="text-3xl font-bold text-white">100%</div>
                <div className="text-sm text-white/50 mt-1">Private</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">Instant</div>
                <div className="text-sm text-white/50 mt-1">Approval</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">0%</div>
                <div className="text-sm text-white/50 mt-1">Data Leaks</div>
              </div>
            </div>
          </RevealOnView>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 lg:py-24 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <RevealOnView className="text-center mb-12">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl mb-4">Why Choose Loanzy?</h2>
            <p className="text-lg text-white/70 max-w-2xl mx-auto">
              Experience the future of privacy-preserving finance with cutting-edge cryptography
            </p>
          </RevealOnView>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, idx) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                gradient={feature.gradient}
                delay={idx * 0.1}
              />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 lg:py-24 border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <RevealOnView>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl mb-4">How It Works</h2>
            <p className="text-lg text-white/70 mb-12">Three simple steps to get your privacy-preserving loan</p>
          </RevealOnView>

          <div className="grid gap-8 md:grid-cols-3">
            <RevealOnView className="relative p-6 rounded-2xl border border-white/10 bg-neutral-900/40">
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center text-xl font-bold">1</div>
              <h3 className="text-xl font-bold mb-2 mt-4">Connect Wallet</h3>
              <p className="text-white/70">Connect your StarkNet wallet (Argent or Braavos) to analyze your on-chain creditworthiness.</p>
            </RevealOnView>

            <RevealOnView className="relative p-6 rounded-2xl border border-white/10 bg-neutral-900/40">
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-xl font-bold">2</div>
              <h3 className="text-xl font-bold mb-2 mt-4">Generate Proof</h3>
              <p className="text-white/70">Our system generates a zero-knowledge proof that verifies your creditworthiness without revealing data.</p>
            </RevealOnView>

            <RevealOnView className="relative p-6 rounded-2xl border border-white/10 bg-neutral-900/40">
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-cyan-500 flex items-center justify-center text-xl font-bold">3</div>
              <h3 className="text-xl font-bold mb-2 mt-4">Get Funded</h3>
              <p className="text-white/70">Once approved, funds are instantly transferred to your wallet via smart contract escrow.</p>
            </RevealOnView>
          </div>

          <div className="mt-12 text-center">
            <Button asChild size="lg" className="rounded-full bg-white text-black hover:bg-white/90">
              <Link href="/wallet-analysis">
                Start Your Application
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
