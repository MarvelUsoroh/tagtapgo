'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const confirmEmail = async () => {
      // Get token from URL parameters
      const token =
        searchParams.get('token_hash') ||
        searchParams.get('token') ||
        searchParams.get('code');
      const rawType = (searchParams.get('type') || 'signup').toLowerCase();
      // Map legacy or incorrect values to Supabase expected types
      const type = ((): 'signup' | 'recovery' | 'magiclink' | 'email_change' => {
        if (rawType === 'email') return 'signup'; // legacy docs used 'email' for signup
        if (rawType === 'signup' || rawType === 'recovery' || rawType === 'magiclink' || rawType === 'email_change') {
          return rawType as 'signup' | 'recovery' | 'magiclink' | 'email_change';
        }
        return 'signup';
      })();

      if (!token) {
        setStatus('error');
        setMessage('Invalid confirmation link. No token provided.');
        return;
      }

      try {
        // Verify the email using the token
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type,
        });

        if (error) {
          throw error;
        }

        // If Supabase returns a session (e.g., signup/magiclink), persist it and send the user in-app
        const session = data?.session;
        if (session?.access_token && session?.refresh_token) {
          await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
          // Attempt to ensure the student profile now that we're authenticated
          try {
            await fetch('/api/ensure-student', { method: 'POST' });
          } catch {}
          setStatus('success');
          setMessage('Your email has been confirmed. Redirecting to your dashboard...');
          // Give the browser a tick to persist cookies/local state, then go home
          setTimeout(() => {
            router.replace('/');
          }, 500);
          return;
        }

        // Fallback: no session returned; send to login with a friendly message
        setStatus('success');
        setMessage('Your email has been confirmed successfully!');
        setTimeout(() => {
          router.push('/login?message=Email confirmed. Please log in.');
        }, 1500);
      } catch (err) {
        console.error('Email confirmation error:', err);
        setStatus('error');
        const errorMessage = err instanceof Error ? err.message : 'Failed to confirm email. The link may be expired or invalid.';
        setMessage(errorMessage);
      }
    };

    confirmEmail();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            {status === 'loading' && (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Confirming Your Email
                </h1>
                <p className="text-gray-600">
                  Please wait while we verify your email address...
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Email Confirmed!
                </h1>
                <p className="text-gray-600 mb-4">{message}</p>
                <p className="text-sm text-gray-500">
                  Redirecting to login page...
                </p>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Confirmation Failed
                </h1>
                <p className="text-gray-600 mb-6">{message}</p>
                <div className="space-y-3">
                  <Link
                    href="/login"
                    className="block w-full py-3 px-4 rounded-lg font-medium text-white text-center"
                    style={{ backgroundColor: colors.primary.DEFAULT }}
                  >
                    Go to Login
                  </Link>
                  <Link
                    href="/signup"
                    className="block text-sm font-medium hover:underline"
                    style={{ color: colors.primary.DEFAULT }}
                  >
                    Create a new account
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-600">
          <p>© 2025 TagTapGo. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <p className="text-gray-600">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <ConfirmContent />
    </Suspense>
  );
}
