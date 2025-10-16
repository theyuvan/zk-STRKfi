'use client'

import { Shield, Wallet, Lock, FileCheck, Zap, TrendingUp } from 'lucide-react'
import RevealOnView from './reveal-on-view'
import { cn } from '@/lib/utils'

const iconMap = {
  Shield,
  Wallet,
  Lock,
  FileCheck,
  Zap,
  TrendingUp,
}

interface FeatureCardProps {
  icon: keyof typeof iconMap
  title: string
  description: string
  gradient: string
  delay?: number
}

export default function FeatureCard({ icon, title, description, gradient, delay = 0 }: FeatureCardProps) {
  const Icon = iconMap[icon]
  
  return (
    <RevealOnView
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-neutral-900/60 p-6 sm:p-8 hover:border-white/20 transition-all duration-300"
      intensity="medium"
    >
      <div className="relative z-10">
        <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4", gradient)}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className="text-white/70">{description}</p>
      </div>
      
      {/* Gradient overlay */}
      <div className={cn("absolute inset-0 opacity-5 bg-gradient-to-br", gradient)} />
    </RevealOnView>
  )
}
