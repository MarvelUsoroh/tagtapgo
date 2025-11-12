/**
 * Rewards Client Component
 * Handles redemption logic and interactivity
 */

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Sparkles, X, Check, AlertCircle } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import RewardCard from '@/components/RewardCard';
import { colors, rewardCategories } from '@/lib/theme';
import { cn, formatNumber, formatDate } from '@/lib/utils';
import { ERROR_MESSAGES } from '@/lib/constants';
import type { Reward, Redemption } from '@/lib/supabase';
import { useRedemption } from '@/hooks/useRedemption';

type TabType = 'catalog' | 'history';

interface Props {
  rewards: Reward[];
  redemptions: Redemption[];
  totalPoints: number;
  studentId: string;
}

export default function RewardsClient({
  rewards: initialRewards,
  redemptions: initialRedemptions,
  totalPoints: initialTotalPoints,
  studentId,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('catalog');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [rewards, setRewards] = useState<Reward[]>(initialRewards);
  const [redemptions, setRedemptions] = useState<Redemption[]>(initialRedemptions);
  const [totalPoints, setTotalPoints] = useState(initialTotalPoints);
  const [filteredRewards, setFilteredRewards] = useState<Reward[]>(initialRewards);

  // Use redemption hook
  const { redeemReward, isRedeeming } = useRedemption();

  // Redemption modal state
  const [showRedemptionModal, setShowRedemptionModal] = useState(false);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successRedemption, setSuccessRedemption] = useState<Redemption | null>(null);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredRewards(rewards);
    } else {
      setFilteredRewards(rewards.filter(r => r.category === selectedCategory));
    }
  }, [selectedCategory, rewards]);

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Handle reward redemption
  const handleRedeem = async () => {
    if (!selectedReward) return;

    // Validate points
    if (totalPoints < selectedReward.points_cost) {
      showToast(ERROR_MESSAGES.INSUFFICIENT_POINTS, 'error');
      return;
    }

    try {
      // Call Edge Function to handle redemption
      const result = await redeemReward(selectedReward.id, studentId);

      // Update local state
      setTotalPoints(result.remaining_points);

      // Add redemption to history
      const newRedemption: Redemption = {
        id: result.redemption.id,
        student_id: studentId,
        reward_id: selectedReward.id,
        points_spent: result.redemption.points_cost,
        redemption_code: result.redemption.redemption_code,
        status: result.redemption.status as 'pending' | 'issued' | 'used' | 'expired' | 'cancelled',
        issued_at: new Date().toISOString(),
        expires_at: result.redemption.expires_at || undefined,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setRedemptions(prev => [newRedemption, ...prev]);

      // Update reward stock
      setRewards(prev =>
        prev.map(r =>
          r.id === selectedReward.id && r.stock !== null
            ? { ...r, stock: r.stock - 1 }
            : r
        )
      );

      // Show success modal with redemption code
      setSuccessRedemption(newRedemption);
      setShowSuccessModal(true);
      setShowRedemptionModal(false);
      setSelectedReward(null);
    } catch (error) {
      console.error('Redemption error:', error);
      showToast(error instanceof Error ? error.message : 'Failed to redeem reward. Please try again.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ paddingBottom: 'var(--bottom-nav-height)' }}>
      {/* Header */}
      <PageHeader
        title="Rewards"
        subtitle="Redeem your points for rewards"
        icon={Gift}
        variant="white"
        actions={
          <div
            className="px-4 py-2 rounded-xl"
            style={{ backgroundColor: colors.primary.DEFAULT + '10' }}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={16} style={{ color: colors.primary.DEFAULT }} />
              <span className="font-bold" style={{ color: colors.primary.DEFAULT }}>
                {formatNumber(totalPoints)}
              </span>
            </div>
            <p className="text-xs" style={{ color: colors.gray[600] }}>
              Available Points
            </p>
          </div>
        }
      />

      {/* Tabs */}
      <div className="bg-white border-b" style={{ borderColor: colors.gray[200] }}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-1">
            {(['catalog', 'history'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 py-3 font-medium text-sm capitalize transition-all',
                  'min-h-[44px]'
                )}
                style={{
                  color: activeTab === tab ? colors.primary.DEFAULT : colors.gray[600],
                  borderBottom: activeTab === tab ? `2px solid ${colors.primary.DEFAULT}` : '2px solid transparent',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-8">
        {activeTab === 'catalog' ? (
          <>
            {/* Category Filters */}
            <div className="mb-6 overflow-x-auto">
              <div className="flex gap-2 pb-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={cn(
                    'px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all',
                    'min-h-[44px]'
                  )}
                  style={{
                    backgroundColor: selectedCategory === 'all' ? colors.primary.DEFAULT : colors.gray[100],
                    color: selectedCategory === 'all' ? 'white' : colors.gray[700],
                  }}
                >
                  All
                </button>

                {Object.entries(rewardCategories).map(([key, { label, icon }]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedCategory(key)}
                    className={cn(
                      'px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all',
                      'min-h-[44px] flex items-center gap-2'
                    )}
                    style={{
                      backgroundColor: selectedCategory === key ? colors.primary.DEFAULT : colors.gray[100],
                      color: selectedCategory === key ? 'white' : colors.gray[700],
                    }}
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Rewards Grid */}
            {filteredRewards.length === 0 ? (
              <div className="text-center py-12">
                <Gift size={48} style={{ color: colors.gray[300] }} className="mx-auto mb-4" />
                <p className="text-lg font-medium mb-2" style={{ color: colors.gray[600] }}>
                  No rewards available
                </p>
                <p className="text-sm" style={{ color: colors.gray[500] }}>
                  Check back later for new rewards
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRewards.map((reward, index) => (
                  <motion.div
                    key={reward.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <RewardCard
                      reward={reward}
                      onRedeem={() => {
                        setSelectedReward(reward);
                        setShowRedemptionModal(true);
                      }}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Redemption History */
          <div className="space-y-4">
            {redemptions.length === 0 ? (
              <div className="text-center py-12">
                <Gift size={48} style={{ color: colors.gray[300] }} className="mx-auto mb-4" />
                <p className="text-lg font-medium mb-2" style={{ color: colors.gray[600] }}>
                  No redemptions yet
                </p>
                <p className="text-sm" style={{ color: colors.gray[500] }}>
                  Start redeeming rewards to see your history
                </p>
              </div>
            ) : (
              redemptions.map((redemption, index) => (
                <motion.div
                  key={redemption.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="bg-white rounded-xl p-4 flex items-center gap-4"
                >
                  <div
                    className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: colors.gray[100] }}
                  >
                    <Gift size={32} style={{ color: colors.primary.DEFAULT }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={{ color: colors.gray[900] }}>
                      {redemption.reward?.name || 'Reward'}
                    </p>
                    <p className="text-sm mb-1" style={{ color: colors.gray[600] }}>
                      {formatDate(redemption.created_at)}
                    </p>
                    {/* Redemption Code */}
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-xs font-mono font-bold px-2 py-1 rounded" style={{
                        backgroundColor: colors.primary.DEFAULT + '20',
                        color: colors.primary.DEFAULT
                      }}>
                        {redemption.redemption_code}
                      </p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(redemption.redemption_code);
                          showToast('Code copied!', 'success');
                        }}
                        className="text-xs px-2 py-1 rounded hover:bg-gray-100"
                        style={{ color: colors.gray[600] }}
                      >
                        Copy
                      </button>
                    </div>
                    {/* Expiry Date */}
                    {redemption.expires_at && (
                      <p className="text-xs mt-1" style={{ color: colors.gray[500] }}>
                        Expires: {formatDate(redemption.expires_at)}
                      </p>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="font-bold" style={{ color: colors.primary.DEFAULT }}>
                      -{formatNumber(redemption.points_spent)}
                    </p>
                    <p
                      className="text-xs px-2 py-1 rounded mt-1"
                      style={{
                        backgroundColor:
                          redemption.status === 'issued'
                            ? colors.success + '20'
                            : redemption.status === 'pending'
                              ? colors.warning + '20'
                              : colors.gray[100],
                        color:
                          redemption.status === 'issued'
                            ? colors.success
                            : redemption.status === 'pending'
                              ? colors.warning
                              : colors.gray[600],
                      }}
                    >
                      {redemption.status}
                    </p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && successRedemption && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl"
            >
              {/* Success Icon */}
              <div className="flex justify-center mb-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: colors.success + '20' }}
                >
                  <Check size={32} style={{ color: colors.success }} />
                </div>
              </div>

              <h3 className="text-xl font-bold text-center mb-2" style={{ color: colors.gray[900] }}>
                Reward Redeemed!
              </h3>
              <p className="text-center mb-6" style={{ color: colors.gray[600] }}>
                Your redemption code is ready
              </p>

              {/* Redemption Code Display */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="text-xs font-medium mb-2 text-center" style={{ color: colors.gray[600] }}>
                  YOUR REDEMPTION CODE
                </p>
                <p
                  className="text-2xl font-mono font-bold text-center mb-3 tracking-wider"
                  style={{ color: colors.primary.DEFAULT }}
                >
                  {successRedemption.redemption_code}
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(successRedemption.redemption_code);
                    showToast('Code copied to clipboard!', 'success');
                  }}
                  className="w-full px-4 py-2 rounded-lg font-medium transition-colors"
                  style={{
                    backgroundColor: colors.primary.DEFAULT,
                    color: 'white',
                  }}
                >
                  Copy Code
                </button>
              </div>

              {/* Reward Details */}
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span style={{ color: colors.gray[600] }}>Reward:</span>
                  <span className="font-medium" style={{ color: colors.gray[900] }}>
                    {successRedemption.reward?.name}
                  </span>
                </div>
                {successRedemption.expires_at && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: colors.gray[600] }}>Expires:</span>
                    <span className="font-medium" style={{ color: colors.gray[900] }}>
                      {formatDate(successRedemption.expires_at)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span style={{ color: colors.gray[600] }}>Points Spent:</span>
                  <span className="font-medium" style={{ color: colors.primary.DEFAULT }}>
                    {formatNumber(successRedemption.points_spent)}
                  </span>
                </div>
              </div>

              {/* Info Message */}
              <div className="flex gap-2 p-3 rounded-lg mb-4" style={{ backgroundColor: colors.warning + '10' }}>
                <AlertCircle size={20} style={{ color: colors.warning, flexShrink: 0 }} />
                <p className="text-xs" style={{ color: colors.gray[700] }}>
                  Save this code! You can also find it in your redemption history.
                </p>
              </div>

              {/* Close Button */}
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setSuccessRedemption(null);
                  // Switch to history tab to show the redemption
                  setActiveTab('history');
                }}
                className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                style={{ minHeight: '44px' }}
              >
                View in History
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Redemption Confirmation Modal */}
      <AnimatePresence>
        {showRedemptionModal && selectedReward && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold" style={{ color: colors.gray[900] }}>
                  Confirm Redemption
                </h3>
                <button
                  onClick={() => setShowRedemptionModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  disabled={isRedeeming}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-sm mb-2" style={{ color: colors.gray[600] }}>
                  You are about to redeem:
                </p>
                <p className="text-lg font-bold mb-4" style={{ color: colors.gray[900] }}>
                  {selectedReward.name}
                </p>

                <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: colors.gray[50] }}>
                  <span className="text-sm" style={{ color: colors.gray[600] }}>
                    Cost:
                  </span>
                  <span className="font-bold" style={{ color: colors.primary.DEFAULT }}>
                    {formatNumber(selectedReward.points_cost)} points
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg mt-2" style={{ backgroundColor: colors.gray[50] }}>
                  <span className="text-sm" style={{ color: colors.gray[600] }}>
                    Remaining:
                  </span>
                  <span className="font-bold" style={{ color: colors.gray[900] }}>
                    {formatNumber(totalPoints - selectedReward.points_cost)} points
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowRedemptionModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                  style={{ minHeight: '44px' }}
                  disabled={isRedeeming}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRedeem}
                  className="flex-1 px-4 py-3 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: colors.primary.DEFAULT,
                    minHeight: '44px',
                  }}
                  disabled={isRedeeming || totalPoints < selectedReward.points_cost}
                >
                  {isRedeeming ? 'Redeeming...' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-4 right-4 z-50"
          >
            <div
              className="max-w-md mx-auto p-4 rounded-lg shadow-lg flex items-center gap-3"
              style={{
                backgroundColor: toast.type === 'success' ? colors.success : colors.danger,
              }}
            >
              {toast.type === 'success' ? (
                <Check size={20} className="text-white" />
              ) : (
                <AlertCircle size={20} className="text-white" />
              )}
              <p className="text-white font-medium">{toast.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
