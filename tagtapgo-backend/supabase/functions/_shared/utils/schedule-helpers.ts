/**
 * Format time until next class for display
 */
export function formatTimeUntilClass(minutesUntil: number): string {
  if (minutesUntil < 0) {
    return 'Class in progress';
  }
  
  if (minutesUntil === 0) {
    return 'Starting now';
  }
  
  if (minutesUntil < 60) {
    return `${minutesUntil} minute${minutesUntil === 1 ? '' : 's'}`;
  }
  
  const hours = Math.floor(minutesUntil / 60);
  const minutes = minutesUntil % 60;
  
  if (minutes === 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  
  return `${hours}h ${minutes}m`;
}
