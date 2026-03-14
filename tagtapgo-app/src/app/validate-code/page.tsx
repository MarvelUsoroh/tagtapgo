/**
 * Brand Partner Code Validation Page
 * Simple interface for brand partners to validate redemption codes
 * 
 * Usage: Brand partner enters code, system validates and marks as used
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoCheckmarkCircle, IoCloseCircle, IoAlertCircle, IoScan } from 'react-icons/io5';
import { colors } from '@/lib/theme';

interface ValidationResult {
  valid: boolean;
  error?: string;
  message: string;
  redemption?: {
    code: string;
    status: string;
    issued_at: string;
    expires_at?: string;
  };
  reward?: {
    name: string;
    brand: string;
    description?: string;
    category: string;
    points_cost: number;
  };
  student?: {
    name: string;
  };
  used_at?: string;
}

export default function ValidateCodePage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);

  async function handleValidate() {
    if (!code.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      // Call validation API
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/validate-redemption-code`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            redemption_code: code.trim().toUpperCase(),
          }),
        }
      );

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Validation error:', error);
      setResult({
        valid: false,
        error: 'Network error',
        message: 'Failed to validate code. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkUsed() {
    if (!code.trim()) return;

    setLoading(true);

    try {
      // Call mark-used API
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/mark-code-used`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            redemption_code: code.trim().toUpperCase(),
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        // Refresh validation to show updated status
        await handleValidate();
      } else {
        setResult({
          valid: false,
          error: data.error,
          message: data.error || 'Failed to mark code as used',
        });
      }
    } catch (error) {
      console.error('Mark used error:', error);
      setResult({
        valid: false,
        error: 'Network error',
        message: 'Failed to mark code as used. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setCode('');
    setResult(null);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <IoScan size={32} style={{ color: colors.primary.DEFAULT }} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Validate Redemption Code</h1>
          <p className="text-gray-600">Enter the student&apos;s redemption code to validate</p>
        </div>

        {/* Input Form */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
            Redemption Code
          </label>
          <div className="flex gap-3">
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && handleValidate()}
              placeholder="e.g., A3F7B2C9"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-lg font-mono uppercase"
              disabled={loading}
              maxLength={8}
            />
            <button
              onClick={handleValidate}
              disabled={loading || !code.trim()}
              className="px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: colors.primary.DEFAULT }}
            >
              {loading ? 'Validating...' : 'Validate'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Enter the 8-character code shown on the student&apos;s phone
          </p>
        </div>

        {/* Validation Result */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`rounded-xl shadow-md p-6 ${
                result.valid ? 'bg-green-50 border-2 border-green-200' :
                'bg-red-50 border-2 border-red-200'
              }`}
            >
              {/* Status Icon */}
              <div className="flex items-start gap-4 mb-4">
                {result.valid ? (
                  <IoCheckmarkCircle size={48} className="text-green-600 flex-shrink-0" />
                ) : result.error?.includes('used') ? (
                  <IoAlertCircle size={48} className="text-orange-600 flex-shrink-0" />
                ) : (
                  <IoCloseCircle size={48} className="text-red-600 flex-shrink-0" />
                )}
                
                <div className="flex-1">
                  <h2 className={`text-2xl font-bold mb-2 ${
                    result.valid ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {result.valid ? 'Valid Code ✓' : 'Invalid Code'}
                  </h2>
                  <p className={`text-lg ${
                    result.valid ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {result.message}
                  </p>
                </div>
              </div>

              {/* Reward Details */}
              {result.valid && result.reward && (
                <div className="bg-white rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Reward Details</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Reward:</span>
                      <span className="font-semibold text-gray-900">{result.reward.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Brand:</span>
                      <span className="font-semibold text-gray-900">{result.reward.brand}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Student:</span>
                      <span className="font-semibold text-gray-900">{result.student?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Points Value:</span>
                      <span className="font-semibold text-gray-900">{result.reward.points_cost} pts</span>
                    </div>
                    {result.redemption?.expires_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Expires:</span>
                        <span className="font-semibold text-gray-900">
                          {new Date(result.redemption.expires_at).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                {result.valid && (
                  <button
                    onClick={handleMarkUsed}
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Mark as Used'}
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Validate Another
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">How to Use:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>Ask the student to show their redemption code</li>
            <li>Enter the 8-character code above</li>
            <li>Click &quot;Validate&quot; to check if the code is valid</li>
            <li>If valid, click &quot;Mark as Used&quot; to redeem</li>
            <li>Provide the reward to the student</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
