'use client';

/**
 * Site-wide page transition. App Router re-mounts `template.tsx` on every
 * navigation, so this plays a subtle enter on each route change. Kept fast and
 * restrained (a short fade + small rise) — premium, not flashy. Respects
 * reduced-motion via Framer's reduced-motion handling.
 */
import { motion } from 'framer-motion';

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
