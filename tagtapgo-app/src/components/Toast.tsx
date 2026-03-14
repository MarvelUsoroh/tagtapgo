'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoCheckmarkCircle, IoCloseCircle, IoAlertCircle, IoTime, IoClose } from 'react-icons/io5';
import { colors } from '@/lib/theme';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  duration?: number;
  onClose: () => void;
}

const toastConfig = {
  success: {
    icon: IoCheckmarkCircle,
    bgColor: colors.success,
    textColor: 'white',
  },
  error: {
    icon: IoCloseCircle,
    bgColor: colors.danger,
    textColor: 'white',
  },
  warning: {
    icon: IoAlertCircle,
    bgColor: colors.warning,
    textColor: 'white',
  },
  info: {
    icon: IoTime,
    bgColor: colors.primary.DEFAULT,
    textColor: 'white',
  },
};

export default function Toast({ message, type, duration = 4000, onClose }: ToastProps) {
  const config = toastConfig[type];
  const Icon = config.icon;

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -50, scale: 0.95 }}
        className="fixed top-4 left-4 right-4 z-50 mx-auto"
        style={{ 
          maxWidth: '28rem', // max-w-md equivalent (448px)
        }}
      >
        <div
          className="rounded-xl shadow-lg p-4 flex items-center gap-3 w-full"
          style={{ backgroundColor: config.bgColor }}
        >
          <Icon size={24} style={{ color: config.textColor, flexShrink: 0 }} />
          <p className="flex-1 font-medium text-sm sm:text-base break-words" style={{ color: config.textColor }}>
            {message}
          </p>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
            aria-label="Close notification"
          >
            <IoClose size={20} style={{ color: config.textColor }} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
