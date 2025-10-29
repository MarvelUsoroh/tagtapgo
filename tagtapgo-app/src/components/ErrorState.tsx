/**
 * Error State Components
 * Reusable error fallback components with retry functionality
 */

'use client';

import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw, WifiOff, ServerCrash, XCircle } from 'lucide-react';
import { colors } from '@/lib/theme';
import { buttonPress } from '@/lib/animations';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  type?: 'network' | 'server' | 'notFound' | 'generic';
  className?: string;
}

const errorConfig = {
  network: {
    icon: WifiOff,
    title: 'Connection Error',
    message: 'Please check your internet connection and try again.',
    color: colors.warning,
  },
  server: {
    icon: ServerCrash,
    title: 'Server Error',
    message: 'Something went wrong on our end. Please try again later.',
    color: colors.danger,
  },
  notFound: {
    icon: XCircle,
    title: 'Not Found',
    message: 'The content you\'re looking for doesn\'t exist.',
    color: colors.gray[400],
  },
  generic: {
    icon: AlertCircle,
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. Please try again.',
    color: colors.danger,
  },
};

/**
 * Error State Component
 * Displays error message with optional retry button
 */
export default function ErrorState({
  title,
  message,
  onRetry,
  type = 'generic',
  className,
}: ErrorStateProps) {
  const config = errorConfig[type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className || ''}`}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        className="mb-4 p-4 rounded-full"
        style={{ backgroundColor: config.color + '20' }}
      >
        <Icon size={48} style={{ color: config.color }} />
      </motion.div>

      <h3 className="text-xl font-bold mb-2" style={{ color: colors.gray[900] }}>
        {title || config.title}
      </h3>

      <p className="text-sm mb-6 max-w-md" style={{ color: colors.gray[600] }}>
        {message || config.message}
      </p>

      {onRetry && (
        <motion.button
          {...buttonPress}
          onClick={onRetry}
          className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white transition-colors"
          style={{ backgroundColor: colors.primary.DEFAULT }}
        >
          <RefreshCw size={20} />
          <span>Try Again</span>
        </motion.button>
      )}
    </motion.div>
  );
}

/**
 * Inline Error Component
 * Smaller error display for inline use
 */
export function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between p-4 rounded-lg"
      style={{ backgroundColor: colors.danger + '10', borderColor: colors.danger, borderWidth: 1 }}
    >
      <div className="flex items-center gap-3">
        <AlertCircle size={20} style={{ color: colors.danger }} />
        <p className="text-sm font-medium" style={{ color: colors.danger }}>
          {message}
        </p>
      </div>
      {onRetry && (
        <motion.button
          {...buttonPress}
          onClick={onRetry}
          className="text-sm font-medium px-3 py-1 rounded"
          style={{ color: colors.danger }}
        >
          Retry
        </motion.button>
      )}
    </div>
  );
}

/**
 * Toast Error Component
 * For temporary error notifications
 */
export function ErrorToast({
  message,
  onClose,
}: {
  message: string;
  onClose?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed top-4 left-4 right-4 z-50 flex items-center justify-between p-4 rounded-lg shadow-lg"
      style={{ backgroundColor: colors.danger, color: 'white' }}
    >
      <div className="flex items-center gap-3">
        <AlertCircle size={20} />
        <p className="text-sm font-medium">{message}</p>
      </div>
      {onClose && (
        <button onClick={onClose} className="ml-4">
          <XCircle size={20} />
        </button>
      )}
    </motion.div>
  );
}
