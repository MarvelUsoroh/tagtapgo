/**
 * Brand Partner Dashboard
 * Shows redemption analytics and ROI metrics for brand partners
 * 
 * NOTE: This is a simple MVP dashboard. In production, this would be:
 * - Behind authentication (brand partner login)
 * - Filtered by brand_id
 * - More sophisticated visualizations
 */

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { IoTrendingUp, IoPeople, IoCart, IoRepeat } from 'react-icons/io5';
import { colors } from '@/lib/theme';

interface BrandMetrics {
  brand_name: string;
  unique_redeemers: number;
  total_redemptions: number;
  total_value: number;
  avg_student_attendance: number;
  avg_student_streak: number;
  avg_repeat_rate: number;
  avg_views_to_convert: number;
  avg_hours_to_convert: number;
}

interface ConversionTier {
  engagement_tier: string;
  students_who_viewed: number;
  students_who_redeemed: number;
  conversion_rate: number;
  avg_transaction_value: number;
  total_value: number;
}

export default function BrandDashboard() {
  const [brandMetrics, setBrandMetrics] = useState<BrandMetrics[]>([]);
  const [conversionData, setConversionData] = useState<ConversionTier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    try {
      // Fetch brand performance
      const { data: brandData, error: brandError } = await supabase
        .from('brand_performance')
        .select('*');

      if (brandError) throw brandError;

      // Fetch conversion funnel
      const { data: conversionData, error: conversionError } = await supabase
        .from('conversion_by_engagement')
        .select('*');

      if (conversionError) throw conversionError;

      setBrandMetrics(brandData || []);
      setConversionData(conversionData || []);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Brand Partner Dashboard</h1>
          <p className="text-gray-600">Real-time redemption analytics and ROI metrics</p>
        </div>

        {/* Conversion Funnel by Engagement */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Conversion by Student Engagement</h2>
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Engagement Tier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Views</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Redemptions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conversion Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {conversionData.map((tier) => (
                  <tr key={tier.engagement_tier}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        tier.engagement_tier.includes('High') ? 'bg-green-100 text-green-800' :
                        tier.engagement_tier.includes('Medium') ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {tier.engagement_tier}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {tier.students_who_viewed?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {tier.students_who_redeemed?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold" style={{ color: colors.success }}>
                        {tier.conversion_rate?.toFixed(1) || 0}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      €{tier.avg_transaction_value?.toFixed(2) || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      €{tier.total_value?.toLocaleString() || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Key Insight */}
          {conversionData.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Key Insight:</strong> Students with 90%+ attendance convert at{' '}
                <strong>{conversionData[0]?.conversion_rate?.toFixed(1)}%</strong> vs.{' '}
                <strong>{conversionData[conversionData.length - 1]?.conversion_rate?.toFixed(1)}%</strong> for low-attendance students.
                That&apos;s <strong>{((conversionData[0]?.conversion_rate || 0) / (conversionData[conversionData.length - 1]?.conversion_rate || 1)).toFixed(1)}x higher conversion</strong>!
              </p>
            </div>
          )}
        </div>

        {/* Brand Performance */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Brand Performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {brandMetrics.map((brand) => (
              <div key={brand.brand_name} className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">{brand.brand_name}</h3>
                
                <div className="space-y-4">
                  {/* Unique Redeemers */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IoPeople size={20} style={{ color: colors.primary.DEFAULT }} />
                      <span className="text-sm text-gray-600">Unique Students</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">
                      {brand.unique_redeemers?.toLocaleString() || 0}
                    </span>
                  </div>

                  {/* Total Redemptions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IoCart size={20} style={{ color: colors.success }} />
                      <span className="text-sm text-gray-600">Total Redemptions</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">
                      {brand.total_redemptions?.toLocaleString() || 0}
                    </span>
                  </div>

                  {/* Repeat Rate */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IoRepeat size={20} style={{ color: colors.warning }} />
                      <span className="text-sm text-gray-600">Repeat Rate</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">
                      {brand.avg_repeat_rate?.toFixed(1) || 0}x
                    </span>
                  </div>

                  {/* Student Quality */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IoTrendingUp size={20} style={{ color: colors.rank.gold }} />
                      <span className="text-sm text-gray-600">Avg Attendance</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">
                      {brand.avg_student_attendance?.toFixed(0) || 0}%
                    </span>
                  </div>

                  {/* Total Value */}
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Total Value</span>
                      <span className="text-2xl font-bold" style={{ color: colors.primary.DEFAULT }}>
                        €{brand.total_value?.toLocaleString() || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {brandMetrics.length === 0 && (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <IoCart size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-600 mb-2">No redemptions yet</p>
              <p className="text-sm text-gray-500">Analytics will appear here once students start redeeming rewards</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
