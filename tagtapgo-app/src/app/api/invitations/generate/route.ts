/**
 * POST /api/invitations/generate
 * 
 * Generates a single invitation token for an enrolled student
 * and sends an invitation email.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { invitationTokenService } from '@/lib/invitation-token-service';
import {
  createInvitation,
  invalidateTokensForStudent,
} from '@/lib/invitation-token-db';

// Validation regex for email
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface GenerateInvitationRequest {
  email: string;
  studentId?: string;
}

interface GenerateInvitationResponse {
  success: boolean;
  invitationId?: string;
  email?: string;
  expiresAt?: string;
  message?: string;
  error?: string;
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

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: GenerateInvitationRequest = await request.json();
    const { email, studentId } = body;

    // Validate email format
    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please provide a valid email address',
        } as GenerateInvitationResponse,
        { status: 400 }
      );
    }

    const supabase = getServiceRoleClient();

    // Find student by email or studentId
    let student;
    if (studentId) {
      const { data, error } = await supabase
        .from('students')
        .select('id, email, first_name, last_name, university_id, auth_user_id')
        .eq('id', studentId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          {
            success: false,
            error: 'Student not found with the provided ID',
          } as GenerateInvitationResponse,
          { status: 404 }
        );
      }

      student = data;
    } else {
      const { data, error } = await supabase
        .from('students')
        .select('id, email, first_name, last_name, university_id, auth_user_id')
        .eq('email', email)
        .single();

      if (error || !data) {
        return NextResponse.json(
          {
            success: false,
            error: 'Student not found with the provided email address',
          } as GenerateInvitationResponse,
          { status: 404 }
        );
      }

      student = data;
    }

    // Check if student already has an auth account
    if (student.auth_user_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Student already has an account. Please use the login page.',
        } as GenerateInvitationResponse,
        { status: 409 }
      );
    }

    // Check if student has active or pending enrollments
    const { data: enrollments, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id, status')
      .eq('student_id', student.id)
      .in('status', ['active', 'pending']);

    if (enrollmentError || !enrollments || enrollments.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Student is not enrolled in any courses',
        } as GenerateInvitationResponse,
        { status: 403 }
      );
    }

    // Invalidate any existing pending tokens for this student
    await invalidateTokensForStudent(student.id);

    // Generate new invitation token
    const { token, tokenHash, expiresAt } =
      await invitationTokenService.generateInvitationToken();

    // Store invitation in database
    const invitation = await createInvitation({
      studentId: student.id,
      email: student.email,
      tokenHash,
      expiresAt,
      metadata: {
        generated_by: 'api',
        student_name: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
      },
    });

    // TODO: Send invitation email (Task 4)
    // For now, we'll log the token (in production, this should be sent via email)
    console.log(`Invitation token for ${student.email}: ${token}`);
    console.log(`Signup URL: ${process.env.NEXT_PUBLIC_APP_URL}/signup?token=${token}`);

    return NextResponse.json(
      {
        success: true,
        invitationId: invitation.id,
        email: invitation.email,
        expiresAt: invitation.expires_at,
        message: 'Invitation generated successfully',
      } as GenerateInvitationResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error generating invitation:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred. Please try again later.',
      } as GenerateInvitationResponse,
      { status: 500 }
    );
  }
}
