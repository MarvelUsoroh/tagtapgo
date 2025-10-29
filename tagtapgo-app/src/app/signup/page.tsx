'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, User, GraduationCap, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { colors } from '@/lib/theme';
import { VALIDATION } from '@/lib/constants';
import SplashScreen from '@/components/SplashScreen';
import useQueryCleanup from '@/hooks/useQueryCleanup';

type University = { id: string; name: string };

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [universities, setUniversities] = useState<University[]>([]);
  const [universitiesLoading, setUniversitiesLoading] = useState<boolean>(true);
  const [universitiesError, setUniversitiesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
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
  }, []);

  // Load universities via server API (safe if RLS blocks anon)
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setUniversitiesError(null);
        setUniversitiesLoading(true);
        const res = await fetch('/api/universities', { cache: 'no-store' });
        if (!res.ok) throw new Error('failed_to_fetch_universities');
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'failed_to_fetch_universities');
        const list: Array<{ id: string; name: string }> = json.universities || [];
        if (mounted) setUniversities(list);
      } catch (e) {
        console.error('Failed to load universities', e);
        if (mounted) setUniversitiesError('Unable to load universities. Please try again later.');
      } finally {
        if (mounted) setUniversitiesLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Clean up transient auth query params (if any reached this page)
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
    if (!name || !email || !password || !universityId) {
      setError('Please fill in all fields');
      return false;
    }

    if (name.length < VALIDATION.NAME_MIN_LENGTH) {
      setError(`Name must be at least ${VALIDATION.NAME_MIN_LENGTH} characters`);
      return false;
    }

    if (name.length > VALIDATION.NAME_MAX_LENGTH) {
      setError(`Name must be less than ${VALIDATION.NAME_MAX_LENGTH} characters`);
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
    setSuccess(false);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            university_id: universityId,
          },
        },
      });

      if (authError) {
        throw authError;
      }

      if (authData.user) {
        // Create student profile
        const { error: profileError } = await supabase
          .from('students')
          .insert({
            id: authData.user.id,
            university_id: universityId,
            email,
            name,
            settings: {},
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
          // Continue anyway - profile can be created later
        }

        setSuccess(true);
        
        // Redirect after a short delay
        setTimeout(() => {
          router.push('/login?message=Please check your email to verify your account');
        }, 2000);
      }
    } catch (err: unknown) {
      console.error('Signup error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = (pwd: string): { strength: number; label: string; color: string } => {
    if (pwd.length === 0) return { strength: 0, label: '', color: '' };
    if (pwd.length < 6) return { strength: 25, label: 'Weak', color: colors.danger };
    if (pwd.length < 8) return { strength: 50, label: 'Fair', color: colors.warning };
    if (pwd.length < 12) return { strength: 75, label: 'Good', color: colors.primary.DEFAULT };
    return { strength: 100, label: 'Strong', color: colors.success };
  };

  const passwordStrength = getPasswordStrength(password);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
               style={{ backgroundColor: colors.primary.DEFAULT }}>
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h1>
          <p className="text-gray-600">Join thousands of students</p>
        </div>

        {/* Signup Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {success ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Created!</h2>
              <p className="text-gray-600 mb-4">
                Please check your email to verify your account.
              </p>
              <p className="text-sm text-gray-500">Redirecting to login...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Name Input */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={cn(
                      'w-full pl-10 pr-4 py-3 border rounded-lg',
                      'focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-all',
                      error && !name ? 'border-red-300' : 'border-gray-300'
                    )}
                    style={{ 
                      '--tw-ring-color': colors.primary.DEFAULT 
                    } as React.CSSProperties}
                    placeholder="John Doe"
                    disabled={loading}
                    autoComplete="name"
                  />
                </div>
              </div>

              {/* Email Input */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
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
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn(
                      'w-full pl-10 pr-4 py-3 border rounded-lg',
                      'focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-all',
                      error && !password ? 'border-red-300' : 'border-gray-300'
                    )}
                    style={{ 
                      '--tw-ring-color': colors.primary.DEFAULT 
                    } as React.CSSProperties}
                    placeholder="Create a strong password"
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>
                {/* Password Strength Indicator */}
                {password && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full transition-all duration-300"
                          style={{ 
                            width: `${passwordStrength.strength}%`,
                            backgroundColor: passwordStrength.color
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium" style={{ color: passwordStrength.color }}>
                        {passwordStrength.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Use at least {VALIDATION.PASSWORD_MIN_LENGTH} characters
                    </p>
                  </div>
                )}
              </div>

              {/* University Selection */}
              <div>
                <label htmlFor="university" className="block text-sm font-medium text-gray-700 mb-2">
                  University
                </label>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    id="university"
                    value={universityId}
                    onChange={(e) => setUniversityId(e.target.value)}
                    className={cn(
                      'w-full pl-10 pr-4 py-3 border rounded-lg appearance-none',
                      'focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-all',
                      error && !universityId ? 'border-red-300' : 'border-gray-300'
                    )}
                    style={{ 
                      '--tw-ring-color': colors.primary.DEFAULT 
                    } as React.CSSProperties}
                    disabled={loading || universitiesLoading || !!universitiesError}
                  >
                    <option value="">{universitiesLoading ? 'Loading…' : 'Select your university'}</option>
                    {universities.map((uni) => (
                      <option key={uni.id} value={uni.id}>
                        {uni.name}
                      </option>
                    ))}
                  </select>
                  {universitiesError && (
                    <p className="mt-2 text-sm text-red-600">{universitiesError}</p>
                  )}
                </div>
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
                    Creating account...
                  </span>
                ) : (
                  'Sign Up'
                )}
              </button>
            </form>
          )}

          {!success && (
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link 
                  href="/login"
                  className="font-medium hover:underline"
                  style={{ color: colors.primary.DEFAULT }}
                >
                  Login
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>© 2025 TagTapGo. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
