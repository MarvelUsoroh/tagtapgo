'use client';

import { motion } from 'framer-motion';

export default function TypingIndicator() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex items-center gap-1 p-4 bg-gray-100 rounded-2xl rounded-bl-none w-fit mb-4"
    >
      <motion.span 
        className="w-2 h-2 bg-brand rounded-full"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
      />
      <motion.span 
        className="w-2 h-2 bg-brand rounded-full"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
      />
      <motion.span 
        className="w-2 h-2 bg-brand rounded-full"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
      />
    </motion.div>
  );
}
