/**
 * POST /api/invitations/signup
 * 
 * Completes student signup by creating a Supabase auth account
 * and linking it to the existing student record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { invitationTokenService } from '@/lib/invitation-token-service';
import {
  getInvitationByTokenHash,
  markTokenAsUsed,
} from '@/lib/invitation-token-db';

interface SignupRequest {
  token: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

interface SignupResponse {
  success: boolean;
  session?: {
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
    };
  };
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
    const body: SignupRequest = await request.json();
    const { token, password, firstName, lastName } = body;

    // Validate required fields
    if (!token || !password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Token and password are required',
        } as SignupResponse,
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password must be at least 8 characters long',
        } as SignupResponse,
        { status: 400 }
      );
    }

    // Validate name lengths if provided
    if (firstName && (firstName.length < 2 || firstName.length > 50)) {
      return NextResponse.json(
        {
          success: false,
          error: 'First name must be between 2 and 50 characters',
        } as SignupResponse,
        { status: 400 }
      );
    }

    if (lastName && (lastName.length < 2 || lastName.length > 50)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Last name must be between 2 and 50 characters',
        } as SignupResponse,
        { status: 400 }
      );
    }

    const supabase = getServiceRoleClient();

    // Hash the token to look it up
    const tokenHash = await invitationTokenService.hashToken(token);

    // Find and validate invitation
    const invitation = await getInvitationByTokenHash(tokenHash);

    if (!invitation) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid invitation token',
        } as SignupResponse,
        { status: 404 }
      );
    }

    // Check if token has expired
    if (invitationTokenService.isExpired(new Date(invitation.expires_at))) {
      return NextResponse.json(
        {
          success: false,
          error: 'This invitation link has expired',
        } as SignupResponse,
        { status: 410 }
      );
    }

    // Check if token has already been used
    if (invitation.status === 'used') {
      return NextResponse.json(
        {
          success: false,
          error: 'This invitation has already been used',
        } as SignupResponse,
        { status: 410 }
      );
    }

    // Fetch student record
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, email, first_name, last_name, auth_user_id')
      .eq('id', invitation.student_id)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        {
          success: false,
          error: 'Student record not found',
        } as SignupResponse,
        { status: 404 }
      );
    }

    // Check if student already has an auth account
    if (student.auth_user_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'An account with this email already exists. Please use the login page.',
        } as SignupResponse,
        { status: 409 }
      );
    }

    // Check if auth account exists for this email
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u: { email?: string }) => u.email?.toLowerCase() === student.email.toLowerCase()
    );

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'An account with this email already exists. Please use the login page.',
        } as SignupResponse,
        { status: 409 }
      );
    }

    // Create Supabase auth account
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: student.email,
        password,
        email_confirm: true, // Auto-confirm email since invitation validates it
      });

    if (authError || !authData.user) {
      console.error('Error creating auth account:', authError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create account. Please try again.',
        } as SignupResponse,
        { status: 500 }
      );
    }

    // Update student record with auth_user_id and optional name updates
    const updateData: {
      auth_user_id: string;
      first_name?: string;
      last_name?: string;
    } = {
      auth_user_id: authData.user.id,
    };

    if (firstName) {
      updateData.first_name = firstName;
    }

    if (lastName) {
      updateData.last_name = lastName;
    }

    const { error: updateError } = await supabase
      .from('students')
      .update(updateData)
      .eq('id', student.id);

    if (updateError) {
      console.error('Error linking auth account to student:', updateError);
      // Try to clean up the auth account
      await supabase.auth.admin.deleteUser(authData.user.id);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to complete signup. Please try again.',
        } as SignupResponse,
        { status: 500 }
      );
    }

    // Mark invitation token as used
    await markTokenAsUsed(invitation.id);

    // Create session for the user
    const { data: sessionData, error: sessionError } =
      await supabase.auth.signInWithPassword({
        email: student.email,
        password,
      });

    if (sessionError || !sessionData.session) {
      console.error('Error creating session:', sessionError);
      return NextResponse.json(
        {
          success: false,
          error: 'Account created but failed to log in. Please use the login page.',
        } as SignupResponse,
        { status: 500 }
      );
    }

    // Return success with session
    return NextResponse.json(
      {
        success: true,
        session: {
          accessToken: sessionData.session.access_token,
          refreshToken: sessionData.session.refresh_token,
          user: {
            id: sessionData.user.id,
            email: sessionData.user.email!,
          },
        },
      } as SignupResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error during signup:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred. Please try again later.',
      } as SignupResponse,
      { status: 500 }
    );
  }
}
