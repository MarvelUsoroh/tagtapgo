import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing Authorization header");
      throw new Error("Missing Authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const body = await req.json();
    console.log("Request body:", JSON.stringify(body));
    const { action, promptId, conversationId, message } = body;
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
      
      console.log(`Starting chat for Course: ${courseName}, Topic: ${topic}`);

      // 2. Create Conversation
      const { data: conversation, error: convError } = await supabaseClient
        .from("feedback_conversations")
        .insert({
          student_id: user.id,
          class_schedule_id: prompt.class_schedule_id,
          metadata: { 
            topic, 
            courseName, 
            prompt_id: promptId,
            state: "SURVEY_PACE" // Start in Survey Mode
          },
          status: "active",
        })
        .select()
        .single();

      if (convError) throw convError;

      // 3. Generate First Question (Survey)
      const aiMessage = `Hi! 👋 Before we review ${courseName}, how was the pace of the lecture today?`;
      const quickReplies = ["Too Fast 🐇", "Just Right 👌", "Too Slow 🐢"];

      // 4. Save AI Message
      await supabaseClient.from("feedback_messages").insert({
        conversation_id: conversation.id,
        sender_type: "ai",
        content: aiMessage,
      });

      return new Response(
        JSON.stringify({ 
          conversationId: conversation.id, 
          message: aiMessage,
          quickReplies 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- ACTION: MESSAGE ---
    if (action === "message") {
      if (!conversationId || !message) throw new Error("Missing ID or message");

      // STEP A: Fetch Conversation Metadata & History
      const { data: conversation } = await supabaseClient
        .from("feedback_conversations")
        .select("*")
        .eq("id", conversationId)
        .single();

      if (!conversation) throw new Error("Conversation not found");

      const currentState = conversation.metadata?.state || "TUTOR"; // Default to TUTOR for old chats

      // --- SURVEY STATE MACHINE ---
      
      if (currentState === "SURVEY_PACE") {
        // 1. Save Pace Answer
        const paceMap: Record<string, number> = { "Too Fast 🐇": 5, "Just Right 👌": 3, "Too Slow 🐢": 1 };
        const paceValue = paceMap[message] || 3; // Default to 3 if custom text

        await supabaseClient
          .from("feedback_conversations")
          .update({ 
            metadata: { 
              ...conversation.metadata, 
              pace_response: message, 
              pace_value: paceValue,
              state: "SURVEY_CLARITY" 
            } 
          })
          .eq("id", conversationId);

        // 2. Save User Message
        await supabaseClient.from("feedback_messages").insert({
          conversation_id: conversationId,
          sender_type: "user",
          content: message,
        });

        // 3. Send Next Question
        const aiMessage = "Got it. And how clear were the concepts presented?";
        const quickReplies = ["Confusing 😕", "Mostly Clear 🤔", "Crystal Clear 💎"];

        await supabaseClient.from("feedback_messages").insert({
          conversation_id: conversationId,
          sender_type: "ai",
          content: aiMessage,
        });

        return new Response(
          JSON.stringify({ message: aiMessage, quickReplies }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (currentState === "SURVEY_CLARITY") {
        // 1. Save Clarity Answer
        const clarityMap: Record<string, number> = { "Confusing 😕": 1, "Mostly Clear 🤔": 3, "Crystal Clear 💎": 5 };
        const clarityValue = clarityMap[message] || 3;

        // 2. Save to Class Feedback Table
        const { pace_value } = conversation.metadata;
        
        // Fetch course_id from class_schedule
        const { data: schedule } = await supabaseClient
          .from("class_schedules")
          .select("course_id, class_id")
          .eq("id", conversation.class_schedule_id)
          .single();

        if (schedule) {
          await supabaseClient.from("class_feedback").insert({
            student_id: user.id,
            class_schedule_id: conversation.class_schedule_id,
            course_id: schedule.course_id,
            class_id: schedule.class_id,
            pace: pace_value,
            clarity: clarityValue,
            content_quality: 3, // Default
            metadata: { source: "venus_chat" }
          });
        }

        // 3. Update State to TUTOR
        await supabaseClient
          .from("feedback_conversations")
          .update({ 
            metadata: { 
              ...conversation.metadata, 
              clarity_response: message, 
              clarity_value: clarityValue,
              state: "TUTOR" 
            } 
          })
          .eq("id", conversationId);

        // 4. Save User Message
        await supabaseClient.from("feedback_messages").insert({
          conversation_id: conversationId,
          sender_type: "user",
          content: message,
        });

        // 5. Generate Transition Message (AI)
        const topic = conversation.metadata?.topic || "the lecture";
        const courseName = conversation.metadata?.courseName || "class";
        
        const systemPrompt = `You are Venus, a helpful tutor. 
        The student just finished a lecture on "${topic}" in ${courseName}.
        
        SURVEY RESULTS:
        - Pace: ${conversation.metadata.pace_response}
        - Clarity: ${message}
        
        Your Goal: Transition from the survey to a helpful review.
        - If they said it was confusing/fast: Be reassuring, offer to break it down.
        - If they said it was clear: Challenge them with a deeper question.
        
        Constraint: Keep it under 30 words. End with a question about the topic.`;

        const client = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY") });
        const chat = client.chats.create({
          model: "gemini-2.5-flash",
          config: { temperature: 0.7, maxOutputTokens: 150 },
          systemInstruction: systemPrompt,
          history: [],
        });

        const result = await chat.sendMessage({ message: "Generate transition" });
        const aiMessage = (typeof result.text === 'function' ? result.text() : result.text) || `Thanks! Let's review ${topic}. What was the main takeaway?`;

        await supabaseClient.from("feedback_messages").insert({
          conversation_id: conversationId,
          sender_type: "ai",
          content: aiMessage,
        });

        return new Response(
          JSON.stringify({ message: aiMessage, quickReplies: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // --- TUTOR MODE (Standard Chat) ---

      // STEP A: Fetch History FIRST (Before inserting new message)
      // This ensures 'history' only contains PAST turns, not the current one.
      const { data: dbHistory } = await supabaseClient
        .from("feedback_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      // STEP B: Insert User Message to DB
      await supabaseClient.from("feedback_messages").insert({
        conversation_id: conversationId,
        sender_type: "user",
        content: message,
      });

      // STEP C: Format History for Gemini
      // Map 'ai' -> 'model' and 'user' -> 'user'
      const pastHistory = (dbHistory || []).map((m: any) => ({
        role: m.sender_type === "ai" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      // STEP D: Prepare Context
      const topic = conversation?.metadata?.topic || "the lecture";
      const systemPrompt = `You are Venus, a helpful tutor. Topic: "${topic}". 
      Guide: Recall -> Elaboration -> Gap Analysis. 
      
      CRITICAL INSTRUCTIONS:
      1. Be concise. Keep responses under 50 words unless explaining a complex concept.
      2. If the user asks for code or examples, keep them SHORT and minimal.
      3. Break down long explanations into smaller, interactive steps. Ask the user if they want to proceed.
      4. Do not dump a wall of text. Use bullet points.`;

      // STEP E: Send to Gemini
      const chat = client.chats.create({
        model: "gemini-2.5-flash",
        config: {
          temperature: 0.7,
          maxOutputTokens: 8192, // Increased to allow for "thinking" tokens
        },
        systemInstruction: systemPrompt,
        history: pastHistory, // This now strictly contains PREVIOUS turns
      });

      const result = await chat.sendMessage({ message: message });
      console.log("Message Chat Result:", JSON.stringify(result, null, 2));
      const aiResponse = (typeof result.text === 'function' ? result.text() : result.text) || "(No response generated. Try asking again.)"; // Fallback

      // STEP F: Save AI Response
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
    console.error("Error in chat-with-venus:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
