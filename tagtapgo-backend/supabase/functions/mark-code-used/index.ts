// @ts-nocheck

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface MarkUsedRequest {
  redemption_code: string
  brand_id?: string // Optional: for brand-specific validation
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const { redemption_code, brand_id }: MarkUsedRequest = await req.json()

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
        status,
        expires_at,
        reward:rewards (
          brand
        )
      `)
      .eq('redemption_code', redemption_code)
      .single()

    if (redemptionError || !redemption) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid redemption code'
        }),
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Check if brand_id matches (if provided)
    if (brand_id && redemption.reward?.brand !== brand_id) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Unauthorized - code belongs to different brand'
        }),
        { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Check if already used
    if (redemption.status === 'used') {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Code already used'
        }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Check if expired
    const now = new Date()
    const expiresAt = redemption.expires_at ? new Date(redemption.expires_at) : null
    
    if (expiresAt && expiresAt < now) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Code expired'
        }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Mark as used
    const { error: updateError } = await supabase
      .from('redemptions')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', redemption.id)

    if (updateError) {
      console.error('Error marking code as used:', updateError)
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to mark code as used'
        }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // Success
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Code marked as used successfully',
        used_at: new Date().toISOString()
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Mark code used error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
