'use client';

import { motion } from 'framer-motion';

interface QuickReplyOptionsProps {
  options: string[];
  onSelect: (option: string) => void;
}

export default function QuickReplyOptions({ options, onSelect }: QuickReplyOptionsProps) {
  if (options.length === 0) return null;

  return (
    <div className="px-4 pb-2">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {options.map((option, index) => (
          <motion.button
            key={index}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(option)}
            className="px-4 py-2 border border-primary text-primary rounded-full text-sm whitespace-nowrap hover:bg-primary/10 transition-colors flex-shrink-0"
          >
            {option}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
