/**
 * Privacy Settings Page
 * Redirects to Coming Soon page
 */

import { redirect } from 'next/navigation';

export default function PrivacyPage() {
  redirect('/coming-soon');
}
