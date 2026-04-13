/**
 * Invitation Token Database Access Layer
 * 
 * Provides database operations for invitation tokens including
 * creation, retrieval, validation, and status updates.
 */

import { createClient } from '@supabase/supabase-js';

// Types
export interface InvitationToken {
  id: string;
  student_id: string;
  email: string;
  token_hash: string;
  status: 'pending' | 'used' | 'expired' | 'invalidated';
  created_at: string;
  expires_at: string;
  used_at: string | null;
  metadata: Record<string, unknown>;
}

export interface CreateInvitationParams {
  studentId: string;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Creates a Supabase client with service role for admin operations
 * Service role bypasses RLS policies
 */
function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Creates a new invitation token in the database
 * 
 * @param params - Invitation token parameters
 * @returns The created invitation token record
 * 
 * Requirements: 1.2 - Store token with email, timestamps
 * Property 2: Token Database Storage Completeness
 */
export async function createInvitation(
  params: CreateInvitationParams
): Promise<InvitationToken> {
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from('invitation_tokens')
    .insert({
      student_id: params.studentId,
      email: params.email,
      token_hash: params.tokenHash,
      expires_at: params.expiresAt.toISOString(),
      status: 'pending',
      metadata: params.metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating invitation:', error);
    throw new Error(`Failed to create invitation: ${error.message}`);
  }

  return data;
}

/**
 * Retrieves an invitation token by its hash
 * 
 * @param tokenHash - The hashed token to look up
 * @returns The invitation token record or null if not found
 * 
 * Requirements: 4.1 - Verify token exists in database
 */
export async function getInvitationByTokenHash(
  tokenHash: string
): Promise<InvitationToken | null> {
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from('invitation_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Error fetching invitation:', error);
    throw new Error(`Failed to fetch invitation: ${error.message}`);
  }

  return data;
}

/**
 * Retrieves an invitation token by student ID and status
 * 
 * @param studentId - The student's ID
 * @param status - Optional status filter (defaults to 'pending')
 * @returns The invitation token record or null if not found
 */
export async function getInvitationByStudentId(
  studentId: string,
  status: 'pending' | 'used' | 'expired' | 'invalidated' = 'pending'
): Promise<InvitationToken | null> {
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from('invitation_tokens')
    .select('*')
    .eq('student_id', studentId)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Error fetching invitation by student:', error);
    throw new Error(`Failed to fetch invitation: ${error.message}`);
  }

  return data;
}

/**
 * Invalidates all pending invitation tokens for a student
 * Uses the database function for atomic operation
 * 
 * @param studentId - The student's ID
 * 
 * Requirements: 1.5 - Invalidate previous token when generating new one
 * Property 5: Token Invalidation on Regeneration
 */
export async function invalidateTokensForStudent(
  studentId: string
): Promise<void> {
  const supabase = getServiceRoleClient();

  const { error } = await supabase.rpc('invalidate_old_invitation_tokens', {
    p_student_id: studentId,
  });

  if (error) {
    console.error('Error invalidating tokens:', error);
    throw new Error(`Failed to invalidate tokens: ${error.message}`);
  }
}

/**
 * Marks an invitation token as used
 * 
 * @param invitationId - The invitation token ID
 * @returns The updated invitation token record
 * 
 * Requirements: 8.3 - Mark token as used with timestamp
 * Property 16: Successful Signup Flow Completeness
 */
export async function markTokenAsUsed(
  invitationId: string
): Promise<InvitationToken> {
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from('invitation_tokens')
    .update({
      status: 'used',
      used_at: new Date().toISOString(),
    })
    .eq('id', invitationId)
    .select()
    .single();

  if (error) {
    console.error('Error marking token as used:', error);
    throw new Error(`Failed to mark token as used: ${error.message}`);
  }

  return data;
}

/**
 * Updates the status of an invitation token
 * 
 * @param invitationId - The invitation token ID
 * @param status - The new status
 * @returns The updated invitation token record
 * 
 * Requirements: 12.1, 12.2 - Track invitation status
 */
export async function updateInvitationStatus(
  invitationId: string,
  status: 'pending' | 'used' | 'expired' | 'invalidated'
): Promise<InvitationToken> {
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from('invitation_tokens')
    .update({ status })
    .eq('id', invitationId)
    .select()
    .single();

  if (error) {
    console.error('Error updating invitation status:', error);
    throw new Error(`Failed to update invitation status: ${error.message}`);
  }

  return data;
}

/**
 * Retrieves all pending invitations for a university
 * 
 * @param universityId - The university's ID
 * @returns Array of pending invitation tokens
 * 
 * Requirements: 12.3 - Query pending invitations by university
 * Property 24: Query Pending Invitations by University
 */
export async function getPendingInvitationsByUniversity(
  universityId: string
): Promise<InvitationToken[]> {
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from('invitation_tokens')
    .select(`
      *,
      students!inner(university_id)
    `)
    .eq('students.university_id', universityId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending invitations:', error);
    throw new Error(`Failed to fetch pending invitations: ${error.message}`);
  }

  return data || [];
}

/**
 * Retrieves invitation history for a student email
 * 
 * @param email - The student's email address
 * @returns Array of all invitation tokens for the email
 * 
 * Requirements: 12.4 - Query invitation history by email
 * Property 25: Query Invitation History by Email
 */
export async function getInvitationHistoryByEmail(
  email: string
): Promise<InvitationToken[]> {
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from('invitation_tokens')
    .select('*')
    .eq('email', email)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching invitation history:', error);
    throw new Error(`Failed to fetch invitation history: ${error.message}`);
  }

  return data || [];
}

/**
 * Deletes invitation tokens older than the specified number of days
 * Uses the database function for efficient cleanup
 * 
 * @returns The number of tokens deleted
 * 
 * Requirements: 10.1 - Cleanup tokens older than 30 days
 * Property 19: Token Cleanup by Age
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase.rpc('cleanup_expired_invitation_tokens');

  if (error) {
    console.error('Error cleaning up expired tokens:', error);
    throw new Error(`Failed to cleanup expired tokens: ${error.message}`);
  }

  return data?.[0]?.deleted_count || 0;
}
