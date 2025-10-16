'use client'

import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

interface AnimatedHeadingProps {
  lines: string[]
  className?: string
}

export default function AnimatedHeading({ lines, className }: AnimatedHeadingProps) {
  return (
    <div className={cn('overflow-hidden', className)}>
      {lines.map((line, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: i * 0.1 }}
        >
          {line}
        </motion.div>
      ))}
    </div>
  )
}
