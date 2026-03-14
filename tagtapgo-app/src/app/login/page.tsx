'use client';

import { useState, FormEvent, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { IoMail, IoLockClosed, IoAlertCircle, IoEye, IoEyeOff } from 'react-icons/io5';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { colors } from '@/lib/theme';
import { VALIDATION, ERROR_MESSAGES } from '@/lib/constants';
import SplashScreen from '@/components/SplashScreen';
import Logo from '@/components/Logo';
import useQueryCleanup from '@/hooks/useQueryCleanup';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Always start with false to match server render, then check in useEffect
  const [showSplash, setShowSplash] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);
  
  // Check if splash should be shown after mount (client-side only)
  useEffect(() => {
    setMounted(true);
    try {
      const shown = sessionStorage.getItem('splash_shown');
      if (!shown) {
        setShowSplash(true);
      }
    } catch {
      // ignore
    }
    
    // Capture URL errors before they are cleaned up
    const errParam = searchParams.get('error');
    if (errParam) {
      if (errParam === 'not_invited') {
        setError('Your email is not registered for the TagTapGo Pilot. Please use your official university email or contact support.');
      } else {
        setError(errParam);
      }
    }
  }, [searchParams]);
  
  // Clean up transient auth query params but preserve returnUrl for login redirect
  useQueryCleanup(['message', 'error', 'code', 'token_hash', 'token', 'type']);

  const handleSplashComplete = () => {
    try {
      sessionStorage.setItem('splash_shown', 'true');
    } catch {
      // ignore
    }
    setShowSplash(false);
  };

  // Show splash screen if needed (only after mount to avoid hydration mismatch)
  if (mounted && showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} duration={3000} />;
  }
  
  // Show nothing during initial mount to match server render
  if (!mounted) {
    return null;
  }

  const validateForm = (): boolean => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return false;
    }

    if (!VALIDATION.EMAIL_REGEX.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }

    if (password.length < VALIDATION.PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${VALIDATION.PASSWORD_MIN_LENGTH} characters`);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        // Check if error is due to unconfirmed email
        if (authError.message.toLowerCase().includes('email not confirmed') || 
            authError.message.toLowerCase().includes('email confirmation')) {
          try {
            // Automatically resend confirmation email
            await supabase.auth.resend({
              type: 'signup',
              email: email,
            });
            setError('Your email is not confirmed. We\'ve sent you a new confirmation link. Please check your email.');
          } catch (resendError) {
            console.error('Error resending confirmation:', resendError);
            setError('Your email is not confirmed. Please check your email for the confirmation link.');
          }
          setLoading(false);
          return;
        }
        throw authError;
      }

      if (data.session) {
        // Get return URL from query params or default to dashboard
        const params = new URLSearchParams(window.location.search);
        const returnUrl = params.get('returnUrl') || '/';
        // Ensure SSR cookies/session are observable before leaving the page
        await supabase.auth.getSession();
        // Ensure the student profile exists (idempotent)
        try {
          await fetch('/api/ensure-student', { method: 'POST' });
        } catch {}
        // Immediately navigate to the intended destination
        router.replace(returnUrl);
      } else {
        throw new Error('No session returned from login');
      }
    } catch (err: unknown) {
      console.error('Login error:', err);
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.UNAUTHORIZED;
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* Logo and Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <Logo size="xl" variant="full" animated className="mb-4" />
          <p className="text-gray-600">Log in to continue your streak</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <IoAlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <IoMail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(
                    'w-full pl-10 pr-4 py-3 border rounded-lg',
                    'focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-all',
                    error && !email ? 'border-red-300' : 'border-gray-300'
                  )}
                  style={{ 
                    '--tw-ring-color': colors.primary.DEFAULT 
                  } as React.CSSProperties}
                  placeholder="your.email@university.edu"
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <IoLockClosed className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(
                    'w-full pl-10 pr-12 py-3 border rounded-lg',
                    'focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-all',
                    error && !password ? 'border-red-300' : 'border-gray-300'
                  )}
                  style={{ 
                    '--tw-ring-color': colors.primary.DEFAULT 
                  } as React.CSSProperties}
                  placeholder="Enter your password"
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 focus:outline-none"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <IoEyeOff className="w-5 h-5" /> : <IoEye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="text-right">
              <Link 
                href="/reset-password"
                className="text-sm font-medium hover:underline"
                style={{ color: colors.primary.DEFAULT }}
              >
                Forgot Password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full py-3 px-4 rounded-lg font-medium text-white',
                'transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-offset-2',
                loading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg transform hover:-translate-y-0.5'
              )}
              style={{ 
                backgroundColor: colors.primary.DEFAULT,
                '--tw-ring-color': colors.primary.DEFAULT
              } as React.CSSProperties}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Logging in...
                </span>
              ) : (
                'Login'
              )}
            </button>
          </form>

          {/* Pilot Notice */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Welcome to the TagTapGo Pilot.<br />
              Please sign in with your official university email.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>© 2025 TagTapGo. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: colors.primary.DEFAULT }}></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}
