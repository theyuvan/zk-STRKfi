'use client'

import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

interface RevealOnViewProps {
  children: React.ReactNode
  className?: string
  as?: any
  intensity?: 'subtle' | 'medium' | 'hero'
  staggerChildren?: boolean
}

export default function RevealOnView({
  children,
  className,
  as = 'div',
  intensity = 'medium',
  staggerChildren = false,
}: RevealOnViewProps) {
  const Component = motion[as] || motion.div

  const variants = {
    hidden: { opacity: 0, y: intensity === 'hero' ? 40 : 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: 'easeOut',
        staggerChildren: staggerChildren ? 0.1 : 0,
      },
    },
  }

  return (
    <Component
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
      variants={variants}
      className={cn(className)}
    >
      {children}
    </Component>
  )
}
