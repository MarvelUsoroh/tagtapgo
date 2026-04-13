'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { IoMail, IoLockClosed, IoAlertCircle, IoEye, IoEyeOff, IoPerson, IoCheckmarkCircle } from 'react-icons/io5';
import { cn } from '@/lib/utils';
import { colors } from '@/lib/theme';
import Logo from '@/components/Logo';

interface StudentInfo {
  firstName: string;
  lastName: string;
  email: string;
  universityName: string;
}

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  // Validation state
  const [validating, setValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);

  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Validate token on page load
  useEffect(() => {
    if (!token) {
      setValidationError('No invitation token provided');
      setValidating(false);
      return;
    }

    async function validate() {
      try {
        const response = await fetch(`/api/invitations/validate?token=${token}`);
        const data = await response.json();

        if (!response.ok || !data.valid) {
          setValidationError(data.error || 'Invalid invitation token');
          setValidating(false);
          return;
        }

        // Set student info and pre-fill form
        setStudentInfo(data.student);
        setFirstName(data.student.firstName);
        setLastName(data.student.lastName);
        setValidating(false);
      } catch (err) {
        console.error('Token validation error:', err);
        setValidationError('Failed to validate invitation. Please try again.');
        setValidating(false);
      }
    }

    validate();
  }, [token]);

  // Password strength calculation
  function getPasswordStrength(pwd: string): { strength: string; color: string } {
    if (pwd.length === 0) return { strength: '', color: '' };
    if (pwd.length < 8) return { strength: 'Too short', color: 'text-red-600' };

    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^a-zA-Z\d]/.test(pwd)) score++;

    if (score <= 2) return { strength: 'Weak', color: 'text-orange-600' };
    if (score === 3) return { strength: 'Fair', color: 'text-yellow-600' };
    if (score === 4) return { strength: 'Good', color: 'text-blue-600' };
    return { strength: 'Strong', color: 'text-green-600' };
  }

  const passwordStrength = getPasswordStrength(password);

  // Form validation
  function validateForm(): boolean {
    if (!password || !confirmPassword) {
      setError('Please fill in all required fields');
      return false;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    if (firstName && (firstName.length < 2 || firstName.length > 50)) {
      setError('First name must be between 2 and 50 characters');
      return false;
    }

    if (lastName && (lastName.length < 2 || lastName.length > 50)) {
      setError('Last name must be between 2 and 50 characters');
      return false;
    }

    return true;
  }

  // Handle form submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/invitations/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password,
          firstName: firstName !== studentInfo?.firstName ? firstName : undefined,
          lastName: lastName !== studentInfo?.lastName ? lastName : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to create account');
        setLoading(false);
        return;
      }

      // Success! Show success message and redirect
      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err) {
      console.error('Signup error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  }

  // Loading state
  if (validating) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: colors.primary.DEFAULT }}></div>
          <p className="text-gray-600">Validating invitation...</p>
        </div>
      </div>
    );
  }

  // Validation error state
  if (validationError) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Logo size="xl" variant="full" className="mb-4" />
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-8">
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
              <IoAlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800 mb-1">Invalid Invitation</p>
                <p className="text-sm text-red-700">{validationError}</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Please request a new invitation from your administrator or contact support if you believe this is an error.
            </p>

            <Link
              href="/login"
              className="block w-full py-3 px-4 rounded-lg font-medium text-white text-center transition-all"
              style={{ backgroundColor: colors.primary.DEFAULT }}
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <IoCheckmarkCircle className="w-16 h-16 mx-auto mb-4" style={{ color: colors.primary.DEFAULT }} />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Created!</h2>
          <p className="text-gray-600 mb-4">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  // Signup form
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <Logo size="xl" variant="full" className="mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Your Account</h1>
          <p className="text-gray-600">Welcome to {studentInfo?.universityName}</p>
        </div>

        {/* Signup Form */}
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <IoAlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Email (Read-only) */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <IoMail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={studentInfo?.email || ''}
                  disabled
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
            </div>

            {/* First Name */}
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                First Name
              </label>
              <div className="relative">
                <IoPerson className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-all"
                  style={{ '--tw-ring-color': colors.primary.DEFAULT } as React.CSSProperties}
                  placeholder="Your first name"
                />
              </div>
            </div>

            {/* Last Name */}
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                Last Name
              </label>
              <div className="relative">
                <IoPerson className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-all"
                  style={{ '--tw-ring-color': colors.primary.DEFAULT } as React.CSSProperties}
                  placeholder="Your last name"
                />
              </div>
            </div>

            {/* Password */}
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
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-all"
                  style={{ '--tw-ring-color': colors.primary.DEFAULT } as React.CSSProperties}
                  placeholder="Create a password (min 8 characters)"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <IoEyeOff className="w-5 h-5" /> : <IoEye className="w-5 h-5" />}
                </button>
              </div>
              {password && (
                <p className={cn('text-sm mt-1', passwordStrength.color)}>
                  Strength: {passwordStrength.strength}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <IoLockClosed className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-all"
                  style={{ '--tw-ring-color': colors.primary.DEFAULT } as React.CSSProperties}
                  placeholder="Confirm your password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <IoEyeOff className="w-5 h-5" /> : <IoEye className="w-5 h-5" />}
                </button>
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
                  Creating Account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/login" className="font-medium hover:underline" style={{ color: colors.primary.DEFAULT }}>
                Log in
              </Link>
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

function SignupFallback() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: colors.primary.DEFAULT }}></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFallback />}>
      <SignupContent />
    </Suspense>
  );
}
