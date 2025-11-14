// @ts-nocheck

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ValidateRequest {
  redemption_code: string
  brand_id?: string // Optional: for brand-specific validation
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const { redemption_code, brand_id }: ValidateRequest = await req.json()

    if (!redemption_code) {
      return new Response(
        JSON.stringify({ error: 'Missing redemption_code' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Find redemption by code
    const { data: redemption, error: redemptionError } = await supabase
      .from('redemptions')
      .select(`
        id,
        student_id,
        reward_id,
        points_spent,
        status,
        redemption_code,
        issued_at,
        expires_at,
        used_at,
        metadata,
        reward:rewards (
          id,
          name,
          brand,
          description,
          category,
          points_cost
        ),
        student:students (
          id,
          full_name,
          first_name,
          last_name,
          email
        )
      `)
      .eq('redemption_code', redemption_code)
      .single()

    if (redemptionError || !redemption) {
      return new Response(
        JSON.stringify({ 
          valid: false,
          error: 'Invalid redemption code',
          message: 'This code does not exist'
        }),
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Check if brand_id matches (if provided)
    if (brand_id && redemption.reward?.brand !== brand_id) {
      return new Response(
        JSON.stringify({ 
          valid: false,
          error: 'Unauthorized',
          message: 'This code belongs to a different brand'
        }),
        { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Check if already used
    if (redemption.status === 'used') {
      return new Response(
        JSON.stringify({ 
          valid: false,
          error: 'Code already used',
          message: 'This code has already been redeemed',
          used_at: redemption.used_at,
          reward_name: redemption.reward?.name,
          student_name: redemption.student?.full_name || 
                       `${redemption.student?.first_name} ${redemption.student?.last_name}`.trim()
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Check if expired
    const now = new Date()
    const expiresAt = redemption.expires_at ? new Date(redemption.expires_at) : null
    
    if (expiresAt && expiresAt < now) {
      return new Response(
        JSON.stringify({ 
          valid: false,
          error: 'Code expired',
          message: 'This code has expired',
          expires_at: redemption.expires_at,
          reward_name: redemption.reward?.name
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Check if cancelled
    if (redemption.status === 'cancelled') {
      return new Response(
        JSON.stringify({ 
          valid: false,
          error: 'Code cancelled',
          message: 'This code has been cancelled'
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Code is valid - return details
    return new Response(
      JSON.stringify({
        valid: true,
        redemption: {
          code: redemption.redemption_code,
          status: redemption.status,
          issued_at: redemption.issued_at,
          expires_at: redemption.expires_at,
        },
        reward: {
          name: redemption.reward?.name,
          brand: redemption.reward?.brand,
          description: redemption.reward?.description,
          category: redemption.reward?.category,
          points_cost: redemption.reward?.points_cost,
        },
        student: {
          name: redemption.student?.full_name || 
                `${redemption.student?.first_name} ${redemption.student?.last_name}`.trim(),
          // Don't expose email for privacy
        },
        message: 'Code is valid and ready to use'
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Validate redemption code error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
