import { colors } from './theme';
import { VALIDATION } from './constants';

/**
 * Password strength tier configuration
 * Tiers are evaluated from highest to lowest minLength
 */
export const PASSWORD_STRENGTH_TIERS = [
  { minLength: 0, strength: 0, label: '', color: '' },
  { minLength: 1, strength: 25, label: 'Weak', color: colors.danger },
  { minLength: VALIDATION.PASSWORD_MIN_LENGTH - 2, strength: 50, label: 'Fair', color: colors.warning },
  { minLength: VALIDATION.PASSWORD_MIN_LENGTH, strength: 75, label: 'Good', color: colors.primary.DEFAULT },
  { minLength: VALIDATION.PASSWORD_MIN_LENGTH + 4, strength: 100, label: 'Strong', color: colors.success },
] as const;

export interface PasswordStrength {
  strength: number;
  label: string;
  color: string;
}

/**
 * Calculate password strength based on length
 * @param password - The password to evaluate
 * @returns Object containing strength percentage, label, and color
 */
export function getPasswordStrength(password: string): PasswordStrength {
  if (!password || password.length === 0) {
    return { strength: 0, label: '', color: '' };
  }

  // Find the highest tier that matches the password length
  const tier = [...PASSWORD_STRENGTH_TIERS]
    .reverse()
    .find(t => password.length >= t.minLength);

  return tier || PASSWORD_STRENGTH_TIERS[0];
}

/**
 * Validate password meets minimum requirements
 * @param password - The password to validate
 * @returns True if password meets minimum length requirement
 */
export function isPasswordValid(password: string): boolean {
  return password.length >= VALIDATION.PASSWORD_MIN_LENGTH;
}

/**
 * Get password validation error message
 * @param password - The password to validate
 * @returns Error message if invalid, null if valid
 */
export function getPasswordError(password: string): string | null {
  if (!password) {
    return 'Password is required';
  }
  
  if (password.length < VALIDATION.PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${VALIDATION.PASSWORD_MIN_LENGTH} characters`;
  }
  
  return null;
}
