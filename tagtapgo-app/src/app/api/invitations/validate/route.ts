/**
 * GET /api/invitations/validate?token={token}
 * 
 * Validates an invitation token and returns student information
 * if the token is valid.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { invitationTokenService } from '@/lib/invitation-token-service';
import { getInvitationByTokenHash } from '@/lib/invitation-token-db';

type ErrorCode = 'INVALID_TOKEN' | 'EXPIRED' | 'ALREADY_USED' | 'STUDENT_NOT_FOUND';

interface ValidationResponse {
  valid: boolean;
  student?: {
    firstName: string;
    lastName: string;
    email: string;
    universityName: string;
  };
  error?: string;
  errorCode?: ErrorCode;
}

/**
 * Creates a Supabase client with service role
 */
function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    // Get token from query params
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Invitation token is required',
          errorCode: 'INVALID_TOKEN',
        } as ValidationResponse,
        { status: 400 }
      );
    }

    // Hash the token to look it up in the database
    const tokenHash = await invitationTokenService.hashToken(token);

    // Find invitation by token hash
    const invitation = await getInvitationByTokenHash(tokenHash);

    if (!invitation) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Invalid invitation token. Please request a new invitation.',
          errorCode: 'INVALID_TOKEN',
        } as ValidationResponse,
        { status: 404 }
      );
    }

    // Check if token has expired
    const expiresAt = new Date(invitation.expires_at);
    if (invitationTokenService.isExpired(expiresAt)) {
      return NextResponse.json(
        {
          valid: false,
          error: 'This invitation link has expired. Please request a new invitation.',
          errorCode: 'EXPIRED',
        } as ValidationResponse,
        { status: 410 }
      );
    }

    // Check if token has already been used
    if (invitation.status === 'used') {
      return NextResponse.json(
        {
          valid: false,
          error: 'This invitation has already been used. Please use the login page.',
          errorCode: 'ALREADY_USED',
        } as ValidationResponse,
        { status: 410 }
      );
    }

    // Check if token has been invalidated
    if (invitation.status === 'invalidated') {
      return NextResponse.json(
        {
          valid: false,
          error: 'This invitation has been replaced by a newer one. Please check your email for the latest invitation.',
          errorCode: 'INVALID_TOKEN',
        } as ValidationResponse,
        { status: 410 }
      );
    }

    const supabase = getServiceRoleClient();

    // Fetch student information
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, email, first_name, last_name, university_id')
      .eq('id', invitation.student_id)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Student record not found. Please contact support.',
          errorCode: 'STUDENT_NOT_FOUND',
        } as ValidationResponse,
        { status: 404 }
      );
    }

    // Fetch university information
    const { data: university } = await supabase
      .from('universities')
      .select('name')
      .eq('id', student.university_id)
      .single();

    const universityName = university?.name || 'Unknown University';

    // Check if student has active or pending enrollments
    const { data: enrollments, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id, status')
      .eq('student_id', student.id)
      .in('status', ['active', 'pending']);

    if (enrollmentError || !enrollments || enrollments.length === 0) {
      return NextResponse.json(
        {
          valid: false,
          error: 'You are not currently enrolled in any courses. Please contact your administrator.',
          errorCode: 'STUDENT_NOT_FOUND',
        } as ValidationResponse,
        { status: 403 }
      );
    }

    // Token is valid - return student information
    return NextResponse.json(
      {
        valid: true,
        student: {
          firstName: student.first_name || '',
          lastName: student.last_name || '',
          email: student.email || invitation.email,
          universityName: universityName || 'Unknown University',
        },
      } as ValidationResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error validating invitation:', error);

    return NextResponse.json(
      {
        valid: false,
        error: 'An unexpected error occurred. Please try again later.',
        errorCode: 'INVALID_TOKEN',
      } as ValidationResponse,
      { status: 500 }
    );
  }
}
