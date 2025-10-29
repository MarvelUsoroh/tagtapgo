'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface RedeemResponse {
  success: boolean;
  redemption: {
    id: string;
    redemption_code: string;
    reward_name: string;
    brand: string;
    points_cost: number;
    status: string;
    expires_at: string | null;
  };
  remaining_points: number;
}

export function useRedemption() {
  const [isRedeeming, setIsRedeeming] = useState(false);

  const redeemReward = async (rewardId: string, studentId: string): Promise<RedeemResponse> => {
    setIsRedeeming(true);
    
    try {
      const { data, error } = await supabase.functions.invoke<RedeemResponse>('redeem-reward', {
        body: {
          reward_id: rewardId,
          student_id: studentId,
        },
      });

      if (error) {
        console.error('Redemption error:', error);
        throw new Error(error.message || 'Failed to redeem reward');
      }

      if (!data) {
        throw new Error('No data returned from redemption');
      }

      return data;
    } finally {
      setIsRedeeming(false);
    }
  };

  return { redeemReward, isRedeeming };
}
