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

        // 3. Update State to TUTOR (Initialize turn counter)
        await supabaseClient
          .from("feedback_conversations")
          .update({ 
            metadata: { 
              ...conversation.metadata, 
              clarity_response: message, 
              clarity_value: clarityValue,
              state: "TUTOR",
              turn: 0 // Initialize turn counter (will be incremented to 1 on first message)
            } 
          })
          .eq("id", conversationId);

        // 4. Save User Message
        await supabaseClient.from("feedback_messages").insert({
          conversation_id: conversationId,
          sender_type: "user",
          content: message,
        });

        // 5. Generate Transition Message (Socratic Start)
        const topic = conversation.metadata?.topic || "the lecture";
        const courseName = conversation.metadata?.courseName || "class";
        const paceResponse = conversation.metadata.pace_response;
        
        // Use a simple template-based transition (no AI needed for this)
        let transitionMessage = "";
        
        if (paceResponse.includes('Fast') || paceResponse.includes('🐇')) {
          if (message.includes('Confusing') || message.includes('😕')) {
            transitionMessage = `I hear you - fast and confusing is tough! Let's slow down and review ${topic}. What's ONE thing that stood out to you today?`;
          } else {
            transitionMessage = `Got it - fast but clear! Let's review ${topic} together. What's the first thing that comes to mind when you think about today's class?`;
          }
        } else if (paceResponse.includes('Slow') || paceResponse.includes('🐢')) {
          transitionMessage = `Thanks for that feedback! Let's dive deeper into ${topic}. What concept would you like to explore more?`;
        } else {
          // Just Right
          if (message.includes('Crystal') || message.includes('💎')) {
            transitionMessage = `Awesome! Sounds like ${topic} clicked for you. What was the most interesting part?`;
          } else {
            transitionMessage = `Thanks! Let's review ${topic}. What's one thing you learned today?`;
          }
        }
        
        const aiMessage = transitionMessage;

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

      // --- TUTOR MODE (Socratic Chat) ---

      // STEP A: Update Turn Counter
      const currentTurn = (conversation.metadata?.turn || 0) + 1;
      const maxTurns = 3;
      const isLastTurn = currentTurn >= maxTurns;

      await supabaseClient
        .from("feedback_conversations")
        .update({ 
          metadata: { 
            ...conversation.metadata, 
            turn: currentTurn,
            ...(isLastTurn && { state: "COMPLETED" })
          },
          ...(isLastTurn && { 
            status: "completed",
            completed_at: new Date().toISOString()
          })
        })
        .eq("id", conversationId);

      // STEP B: Fetch History FIRST (Before inserting new message)
      const { data: dbHistory } = await supabaseClient
        .from("feedback_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      // STEP C: Insert User Message to DB
      await supabaseClient.from("feedback_messages").insert({
        conversation_id: conversationId,
        sender_type: "user",
        content: message,
      });

      // STEP D: Format History for Gemini
      const pastHistory = (dbHistory || []).map((m: any) => ({
        role: m.sender_type === "ai" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      // STEP E: Build "Stingy Tutor" System Prompt (Pivot, Don't Explain)
      const topic = conversation?.metadata?.topic || "the lecture";
      const courseName = conversation?.metadata?.courseName || "class";
      const paceResponse = conversation?.metadata?.pace_response || "";
      const clarityResponse = conversation?.metadata?.clarity_response || "";
      
      // Build ultra-strict prompt that prevents lecture dumps
      let systemPrompt = `IDENTITY: You are Venus, a "Stingy Socratic Tutor".
TOPIC: ${topic}
COURSE: ${courseName}

CORE RULES (VIOLATION = FAILURE):
1. ⛔ NO LECTURING: Never explain "Why" the student is right.
2. ⛔ NO WALLS OF TEXT: Maximum response length is 35 words.
3. ⛔ NO LISTS: Do not use bullet points.
4. ⛔ NO ENTHUSIASM DUMPS: Do not say "That's a really good way to think about it!" or "That's insightful!"
5. ✅ PIVOT IMMEDIATELY: If the student answers correctly, acknowledge it in 3 words max, then ask the NEXT logical question.

STRATEGY - "THE PIVOT":
- Bad Response: "Correct! A baseline is useful because [explanation]..."
- Good Response: "Spot on. If it's a baseline, does that make it cheap or expensive to build initially?"

FEW-SHOT TRAINING EXAMPLES:
Student: "It's like a baseline."
Venus: "Spot on. If we have a strong baseline, do we need to retrain it for every new task?"

Student: "No, we can reuse it."
Venus: "Precisely. So is a foundation model more like a Specialist or a Generalist?"

Student: "A generalist?"
Venus: "Exactly. Can you think of a downside to being a generalist rather than a specialist?"

Student: "What is a foundation model?"
Venus: "What does the word 'foundation' suggest to you in building a house?"

ADAPTATION (Based on Survey):
- Pace: ${paceResponse}${paceResponse.includes('Fast') || paceResponse.includes('🐇') ? ' → Keep questions simple' : ''}
- Clarity: ${clarityResponse}${clarityResponse.includes('Confusing') || clarityResponse.includes('😕') ? ' → Use simple analogies' : ''}
`;

      if (!isLastTurn) {
        // TURNS 1 & 2: ACTIVE QUESTIONING
        systemPrompt += `
CURRENT STATE: Turn ${currentTurn}/${maxTurns}. Keep probing. Do NOT explain. Ask the next question.`;
      } else {
        // TURN 3: GRACEFUL EXIT
        systemPrompt += `
CURRENT STATE: Final Turn (${currentTurn}/${maxTurns}). Stop questioning. Say "Great work" and end the session in 1 sentence.`;
      }

      // STEP F: Send to Gemini with "Stingy Tutor" Prompt + Silent Instruction
      const chat = client.chats.create({
        model: "gemini-2.5-flash",
        config: {
          temperature: 0.3, // Low temp reduces "chatty" creativity
          maxOutputTokens: 8192, // Increased to allow for "thinking" tokens, even if output is short
        },
        systemInstruction: systemPrompt,
        history: pastHistory,
      });

      // Add silent instruction to prevent "Keyword Trap" (AI explaining topics)
      const silentInstruction = `
(SYSTEM INJECTION: 
1. Do NOT explain this topic. 
2. Do NOT say "Let's break it down". 
3. Instead, ask me a checking question to see what I remember about it. 
4. Keep response under 30 words.)`;

      const messageToSend = `${message} ${silentInstruction}`;
      const result = await chat.sendMessage({ message: messageToSend });
      
      // DEBUGGING: Check model behavior
      console.log("Turn:", currentTurn, "IsLast:", isLastTurn);
      console.log("Finish Reason:", result.candidates?.[0]?.finishReason);
      console.log("Response length:", result.text?.length || 0);
      
      // Extract text with fallback for empty responses
      const aiResponse = (typeof result.text === 'function' ? result.text() : result.text) || "(No response generated. Try asking again.)";
      
      // Warn if response is empty (shouldn't happen without token limits)
      if (!aiResponse || aiResponse === "(No response generated. Try asking again.)") {
        console.warn("⚠️ Empty response detected. Check system prompt or model issues.");
      }
      
      console.log("Final Response:", aiResponse);

      // STEP G: Save AI Response
      await supabaseClient.from("feedback_messages").insert({
        conversation_id: conversationId,
        sender_type: "ai",
        content: aiResponse,
      });

      return new Response(
        JSON.stringify({ 
          message: aiResponse,
          isComplete: isLastTurn, // Frontend can show completion UI
          turn: currentTurn,
          maxTurns: maxTurns
        }),
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
