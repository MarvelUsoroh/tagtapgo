import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { GoogleGenAI } from "https://esm.sh/@google/genai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { action, promptId, conversationId, message } = await req.json();
    const client = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY") });

    // Initialize Chat
    if (action === "start") {
      if (!promptId) throw new Error("promptId is required to start chat");

      // 1. Get Prompt & Context
      const { data: prompt, error: promptError } = await supabaseClient
        .from("feedback_prompts")
        .select(`
          *,
          class_schedules (
            course_id,
            courses ( name, code )
          )
        `)
        .eq("id", promptId)
        .single();

      if (promptError || !prompt) throw new Error("Prompt not found");

      const topic = prompt.metadata?.topic || "today's lecture";
      const courseName = prompt.class_schedules?.courses?.name || "class";

      // 2. Create Conversation
      const { data: conversation, error: convError } = await supabaseClient
        .from("feedback_conversations")
        .insert({
          student_id: user.id,
          class_schedule_id: prompt.class_schedule_id,
          metadata: { topic, courseName, prompt_id: promptId },
          status: "active",
        })
        .select()
        .single();

      if (convError) throw convError;

      // 3. Generate First Question (Recall)
      const systemPrompt = `You are Venus, a helpful, patient, and encouraging academic tutor. 
      The student just finished a lecture on "${topic}" in the course "${courseName}".
      Your goal is to help them reflect on what they learned.
      Start by asking a simple recall question about the main concept of "${topic}".
      Keep it short, friendly, and encouraging. Use emojis.`;

      const chat = client.chats.create({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: systemPrompt,
        },
      });

      const result = await chat.sendMessage("Start the session.");
      const aiMessage = result.text; // New SDK might return text directly or result.text()

      // 4. Save AI Message
      await supabaseClient.from("feedback_messages").insert({
        conversation_id: conversation.id,
        sender_type: "ai",
        content: aiMessage,
      });

      return new Response(
        JSON.stringify({ conversationId: conversation.id, message: aiMessage }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Continue Chat
    if (action === "message") {
      if (!conversationId || !message) throw new Error("conversationId and message required");

      // 1. Save User Message
      await supabaseClient.from("feedback_messages").insert({
        conversation_id: conversationId,
        sender_type: "user",
        content: message,
      });

      // 2. Get History & Context
      const { data: conversation } = await supabaseClient
        .from("feedback_conversations")
        .select("*")
        .eq("id", conversationId)
        .single();
        
      const { data: history } = await supabaseClient
        .from("feedback_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      const topic = conversation?.metadata?.topic || "the lecture";
      
      // 3. Generate AI Response
      const systemPrompt = `You are Venus, a helpful, patient, and encouraging academic tutor.
      The topic is "${topic}". 
      Guide the student through: Recall -> Elaboration -> Gap Analysis.
      If they answered the recall question well, ask them to explain it simply (Elaboration).
      If they elaborated, ask if anything was confusing (Gap).
      If they are done, thank them and say goodbye.
      Keep responses under 50 words. Use emojis.`;

      // Convert history to Gemini format
      const pastHistory = history!.filter((m: any) => m.content !== message).map((m: any) => ({
        role: m.sender_type === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      }));

      const chat = client.chats.create({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: systemPrompt,
        },
        history: pastHistory,
      });

      const result = await chat.sendMessage(message);
      const aiResponse = result.text;

      // 4. Save AI Response
      await supabaseClient.from("feedback_messages").insert({
        conversation_id: conversationId,
        sender_type: "ai",
        content: aiResponse,
      });

      return new Response(
        JSON.stringify({ message: aiResponse }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action");

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
