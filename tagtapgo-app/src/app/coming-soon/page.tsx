/**
 * Coming Soon Page
 * Placeholder for features under development
 */

'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Wrench } from 'lucide-react';
import { colors } from '@/lib/theme';

export default function ComingSoonPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 safe-area-top" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            style={{ minHeight: '44px' }}
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-6"
            style={{ backgroundColor: `${colors.primary.DEFAULT}20` }}
          >
            <Wrench size={48} style={{ color: colors.primary.DEFAULT }} />
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold text-gray-900 mb-4"
          >
            Coming Soon
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-gray-600 mb-8"
          >
            We&apos;re working hard to bring you this feature. Check back soon for updates!
          </motion.p>

          {/* Back Button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            onClick={() => router.back()}
            className="px-6 py-3 text-white font-medium rounded-lg transition-colors"
            style={{ 
              backgroundColor: colors.primary.DEFAULT,
              minHeight: '44px'
            }}
          >
            Go Back
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
