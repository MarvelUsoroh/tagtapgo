/**
 * Basic Profanity Filter
 * Simple regex-based filter for common profanity
 * For production, consider using a more sophisticated library
 */

const PROFANITY_PATTERNS = [
  /\bf+u+c+k+/gi,
  /\bs+h+i+t+/gi,
  /\bb+i+t+c+h+/gi,
  /\ba+s+s+h+o+l+e+/gi,
  /\bd+a+m+n+/gi,
  /\bc+r+a+p+/gi,
  /\bp+i+s+s+/gi,
  /\bc+u+n+t+/gi,
  /\bd+i+c+k+/gi,
  /\bp+u+s+s+y+/gi,
  /\bc+o+c+k+/gi,
  /\bn+i+g+g+/gi,
  /\bf+a+g+/gi,
  /\br+e+t+a+r+d+/gi,
];

export function containsProfanity(text: string): boolean {
  return PROFANITY_PATTERNS.some(pattern => pattern.test(text));
}

export function filterProfanity(text: string): string {
  let filtered = text;
  PROFANITY_PATTERNS.forEach(pattern => {
    filtered = filtered.replace(pattern, (match) => '*'.repeat(match.length));
  });
  return filtered;
}
