// deno-lint-ignore no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// deno-lint-ignore no-import-prefix
import { createClient } from "npm:@supabase/supabase-js@2";
// deno-lint-ignore no-import-prefix
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
      
      // Extract session context from metadata (populated by Moodle sync)
      const sessionContext = prompt.metadata?.sessionContext || null;
      
      console.log(`Starting chat for Course: ${courseName}, Topic: ${topic}`);
      if (sessionContext) {
        console.log(`Session context available:`, JSON.stringify(sessionContext));
      }

      // 2. Check if conversation already exists for this student + schedule
      const { data: existingConversation } = await supabaseClient
        .from("feedback_conversations")
        .select("*")
        .eq("student_id", user.id)
        .eq("class_schedule_id", prompt.class_schedule_id)
        .single();

      if (existingConversation) {
        // Resume existing conversation - fetch the last AI message
        const { data: lastMessages } = await supabaseClient
          .from("feedback_messages")
          .select("*")
          .eq("conversation_id", existingConversation.id)
          .order("created_at", { ascending: false })
          .limit(1);

        const lastMessage = lastMessages?.[0];
        const currentState = existingConversation.metadata?.state || "TUTOR";
        
        // Determine quick replies based on state
        let quickReplies: string[] = [];
        if (currentState === "SURVEY_PACE") {
          quickReplies = ["Too Fast 🐇", "Just Right 👌", "Too Slow 🐢"];
        } else if (currentState === "SURVEY_CLARITY") {
          quickReplies = ["Confusing 😕", "Mostly Clear 🤔", "Crystal Clear 💎"];
        }

        console.log(`Resuming existing conversation ${existingConversation.id}, state: ${currentState}`);

        return new Response(
          JSON.stringify({ 
            conversationId: existingConversation.id, 
            message: lastMessage?.content || "Welcome back! Let's continue our chat.",
            quickReplies,
            resumed: true
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 3. Create New Conversation (no existing one found)
      const { data: conversation, error: convError } = await supabaseClient
        .from("feedback_conversations")
        .insert({
          student_id: user.id,
          class_schedule_id: prompt.class_schedule_id,
          metadata: { 
            topic, 
            courseName, 
            prompt_id: promptId,
            sessionContext, // Pass session context to conversation
            state: "SURVEY_PACE" // Start in Survey Mode
          },
          status: "active",
        })
        .select()
        .single();

      if (convError) throw convError;

      // 4. Generate First Question (Survey)
      const aiMessage = `Hi! 👋 Before we review ${courseName}, how was the pace of the lecture today?`;
      const quickReplies = ["Too Fast 🐇", "Just Right 👌", "Too Slow 🐢"];

      // 5. Save AI Message
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

      // Initialize Gemini client (only needed for Tutor mode)
      const client = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY") });

      // STEP A: Update Turn Counter
      const currentTurn = (conversation.metadata?.turn || 0) + 1;
      // Removed maxTurns limit to allow unlimited chat
      
      await supabaseClient
        .from("feedback_conversations")
        .update({ 
          metadata: { 
            ...conversation.metadata, 
            turn: currentTurn
          }
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
      // deno-lint-ignore no-explicit-any
      const pastHistory = (dbHistory || []).map((m: any) => ({
        role: m.sender_type === "ai" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      // STEP D2: Detect user confusion for MCQ scaffolding
      const confusionPatterns = /\b(idk|i don'?t know|i dont know|no idea|not sure|i'?m not sure|confused|i'?m confused|help|what\??|huh\??|i forgot|i don'?t remember|i dont remember|no clue|beats me|unsure|i'?m unsure)\b/i;
      const isConfused = confusionPatterns.test(message);

      // STEP E: Build "Stingy Tutor" System Prompt (Pivot, Don't Explain)
      const topic = conversation?.metadata?.topic || "the lecture";
      const courseName = conversation?.metadata?.courseName || "class";
      const paceResponse = conversation?.metadata?.pace_response || "";
      const clarityResponse = conversation?.metadata?.clarity_response || "";
      const sessionContext = conversation?.metadata?.sessionContext || null;
      
      // Build session context section if available
      let sessionContextSection = "";
      if (sessionContext) {
        const parts: string[] = [];
        
        if (sessionContext.lessonTitle) {
          parts.push(`Lesson: ${sessionContext.lessonTitle}`);
        }
        if (sessionContext.learningObjectives && sessionContext.learningObjectives.length > 0) {
          parts.push(`Learning Objectives: ${sessionContext.learningObjectives.join(", ")}`);
        }
        if (sessionContext.keyTopics && sessionContext.keyTopics.length > 0) {
          parts.push(`Key Topics Covered: ${sessionContext.keyTopics.join(", ")}`);
        }
        if (sessionContext.keyTerms && sessionContext.keyTerms.length > 0) {
          parts.push(`Key Terms: ${sessionContext.keyTerms.join(", ")}`);
        }
        if (sessionContext.summary) {
          parts.push(`Summary: ${sessionContext.summary}`);
        }
        
        if (parts.length > 0) {
          sessionContextSection = `\n\nSESSION CONTEXT (Use this to guide your questions):\n${parts.join("\n")}`;
        }
      }
      
      // Build ultra-strict prompt that prevents lecture dumps
      const systemPrompt = `IDENTITY: You are Venus, a "Stingy Socratic Tutor".
TOPIC: ${topic}
COURSE: ${courseName}${sessionContextSection}

CORE RULES (VIOLATION = FAILURE):
1. ⛔ NO LECTURING: Never explain "Why" the student is right.
2. ⛔ NO WALLS OF TEXT: Maximum response length is 40 words.
3. ⛔ NO LISTS: Do not use bullet points unless offering an MCQ.
4. ⛔ NO ENTHUSIASM DUMPS: Do not say "That's a really good way to think about it!" or "That's insightful!"
5. ✅ PIVOT IMMEDIATELY: If the student answers correctly, acknowledge it in 3 words max, then ask the NEXT logical question.
6. ✅ EMPATHY FIRST: If the student says "I don't know" or is confused, VALIDATE the struggle ("That's a tricky one", "No worries") before asking.
7. ✅ SCAFFOLD WITH MCQs: If the student is stuck, offer a 3-option Multiple Choice Question to help them.

STRATEGY - "THE PIVOT" & "THE SCAFFOLD":
- Bad Response (Stuck User): "What kind of software was it?" (Too blunt)
- Good Response (Stuck User): "No worries, it's a specific term. Was it: A) A Virus, B) A Trojan, or C) Ransomware?"

FEW-SHOT TRAINING EXAMPLES:
Student: "It's like a baseline."
Venus: "Spot on. If we have a strong baseline, do we need to retrain it for every new task?"

Student: "I don't know how to put it."
Venus: "That's okay, it's hard to describe. Would you say it was more like: A) Stealing data, or B) Locking files?"

Student: "Stealing data."
Venus: "Exactly. And what specific kind of data were they after?"

Student: "What is a foundation model?"
Venus: "Think about a house. What does the 'foundation' do for the rest of the structure?"

ADAPTATION (Based on Survey):
- Pace: ${paceResponse}${paceResponse.includes('Fast') || paceResponse.includes('🐇') ? ' → Keep questions simple' : ''}
- Clarity: ${clarityResponse}${clarityResponse.includes('Confusing') || clarityResponse.includes('😕') ? ' → Use simple analogies' : ''}

CURRENT STATE: Turn ${currentTurn}. Keep probing. Do NOT explain. Ask the next question.`;

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
      // If user is confused, force MCQ response
      const confusionBoost = isConfused 
        ? "\n(⚠️ USER IS CONFUSED - YOU MUST respond with a supportive phrase + a 3-option MCQ. Do NOT ask an open-ended question.)" 
        : "";
      
      const silentInstruction = `
(SYSTEM INJECTION: 
1. Do NOT explain this topic. 
2. Do NOT say "Let's break it down". 
3. Instead, ask me a checking question to see what I remember about it. 
4. Keep response under 30 words.)${confusionBoost}`;

      const messageToSend = `${message} ${silentInstruction}`;
      const result = await chat.sendMessage({ message: messageToSend });
      
      // DEBUGGING: Check model behavior
      console.log("Turn:", currentTurn);
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
          isComplete: false, // Always false to allow unlimited chat
          turn: currentTurn
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action");
  // deno-lint-ignore no-explicit-any
  } catch (error: any) {
    console.error("Error in chat-with-venus:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
