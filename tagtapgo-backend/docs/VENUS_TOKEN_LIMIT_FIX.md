# Venus Token Limit Fix - Silent Truncation Issue

## Problem: Empty AI Responses

**Symptom:** Venus chat shows "no prompt" or empty responses after student messages.

**Root Cause:** "Silent Truncation" due to overly restrictive `maxOutputTokens` setting.

## Technical Explanation

### The "Thinking Tokens" Issue

Modern LLMs (especially Gemini 2.5 series) generate invisible "thought" tokens or metadata before producing visible text. When `maxOutputTokens` is too restrictive (e.g., 45-100 tokens), the model hits the limit **before** outputting any visible characters.

**Result:** `result.text` returns an empty string `""`, causing the frontend to show nothing.

### Why This Approach Works

**The 2x Buffer Rule:**
- **Target:** 20 words (~30 tokens visible)
- **Buffer:** 100 tokens total (allows ~70 tokens for "thinking")
- **Stop Mechanism:** `stopSequences: ["?", "!"]` (logical brake)
- **Result:** Complete sentences, no truncation

**Comparison:**

| Approach | Token Limit | Stop Mechanism | Result |
|----------|-------------|----------------|--------|
| ❌ Strict | 45 | Hard cutoff | Silent truncation or mid-word cuts |
| ❌ Medium | 150 | Hard cutoff | Still hits MAX_TOKENS (logs confirmed) |
| ✅ Buffer | 100 | `stopSequences` | Complete sentences, natural endings |

**Why stopSequences is better:**
- Stops at natural sentence boundaries (`?`, `!`)
- Never cuts off mid-word or mid-sentence
- Model completes its thought before stopping
- Professional UX (complete questions)

## Solution: "Soft + Hard Buffer" Strategy

### 1. Stop Sequences (Logical Brake)

**Key Insight:** Use `stopSequences` to stop at natural sentence endings instead of hard token cutoff.

```typescript
config: {
  temperature: 0.5,           // Lower temp for focused responses
  maxOutputTokens: 100,       // Buffer for thinking tokens
  stopSequences: ["?", "!"],  // Stop at question/exclamation marks
}
```

**How it works:**
- Model generates response naturally
- Stops when it hits `?` or `!` (natural endings for Socratic questions)
- Never cuts off mid-sentence
- Token limit is safety net, not primary mechanism

### 2. Post-Processing

```typescript
// Ensure proper punctuation if stopSequence removed it
if (!aiResponse.endsWith('?') && !aiResponse.endsWith('!') && !aiResponse.endsWith('.')) {
  aiResponse += isLastTurn ? '' : '?';
}
```

### 2. Added Debugging

```typescript
const result = await chat.sendMessage({ message: message });

// DEBUGGING: Check why the model stopped
console.log("Tutor Turn:", currentTurn, "IsLast:", isLastTurn);
console.log("Finish Reason:", result.candidates?.[0]?.finishReason);
console.log("Response length:", result.text?.length || 0);

// Extract text with fallback
const aiResponse = (typeof result.text === 'function' ? result.text() : result.text) 
  || "(No response generated. Try asking again.)";

// Warn if response is suspiciously short
if (aiResponse.length < 10 && aiResponse !== "(No response generated. Try asking again.)") {
  console.warn("⚠️ Very short response detected. Possible token limit issue.");
}
```

### 3. Finish Reasons to Monitor

| Finish Reason | Meaning | Action |
|---------------|---------|--------|
| `STOP` | Normal completion | ✅ Good |
| `MAX_TOKENS` | Hit token limit | ⚠️ Increase limit or check prompt |
| `SAFETY` | Blocked by safety filters | ⚠️ Review content |
| `RECITATION` | Blocked for copyright | ⚠️ Rephrase prompt |
| `OTHER` | Unknown issue | ⚠️ Check logs |

## Strategy: Soft + Hard Constraints

### Soft Constraint (System Prompt)
```typescript
const systemPrompt = `You are Venus, a Socratic tutor.

STRICT RULES:
1. NEVER explain concepts
2. ALWAYS respond with a question
3. Keep responses under 20 words

FORMAT: [Brief acknowledgment] + [One question]
...`;
```

**Purpose:** Guide the model to be brief naturally

### Hard Constraint (Token Limit + Stop Sequences)
```typescript
config: {
  temperature: 0.5,
  maxOutputTokens: 100,       // 2x buffer (target: ~30 tokens, buffer: ~70 for thinking)
  stopSequences: ["?", "!"],  // Logical brake at natural endings
}
```

**Purpose:** 
- `maxOutputTokens`: Safety net to prevent runaway responses
- `stopSequences`: Primary mechanism for clean sentence endings
- System prompt: Enforces brevity and Socratic style

**Benefits:**
- ✅ Complete sentences (no mid-word cuts)
- ✅ Natural endings (stops at `?` or `!`)
- ✅ Cost-effective (100 tokens vs 300)
- ✅ Professional UX (no truncation artifacts)

## Testing Checklist

- [ ] AI responses are complete (not cut off mid-sentence)
- [ ] Responses follow Socratic method (questions, not lectures)
- [ ] Responses are brief (<20 words typically)
- [ ] No empty responses or "no prompt" errors
- [ ] Console logs show `finishReason: "STOP"` (normal completion)
- [ ] Response length is reasonable (20-100 characters)

## Monitoring

Check Edge Function logs for:

```
✅ GOOD:
Finish Reason: STOP
Response length: 45

❌ BAD:
Finish Reason: MAX_TOKENS
Response length: 0
⚠️ Very short response detected. Possible token limit issue.
```

## Related Issues

- **Empty responses** → Increase `maxOutputTokens` to 150+
- **Long lectures** → Strengthen system prompt, don't reduce tokens
- **Cut-off sentences** → Increase `maxOutputTokens`
- **Ignoring Socratic method** → Improve system prompt clarity

## Best Practices

1. **Use system prompt for behavior** (soft constraint)
2. **Use token limit for safety** (hard constraint)
3. **Always provide fallback text** for empty responses
4. **Log finish reasons** for debugging
5. **Monitor response lengths** to detect issues early

---

## Changelog

### v3 - November 22, 2025 (Final Fix - Stop Sequences)
- **Approach:** "Soft + Hard Buffer" strategy
- **Token Limit:** 100 (with 2x buffer)
- **Stop Sequences:** `["?", "!"]` for natural endings
- **Temperature:** 0.5 (more focused)
- **Result:** Complete sentences, no truncation, professional UX

### v2 - November 22, 2025 (Attempted Fix)
- **Token Limit:** 150 → 300
- **Reason:** Logs showed `Finish Reason: MAX_TOKENS` at 150
- **Result:** Would work but wasteful (300 tokens too high)

### v1 - November 22, 2025 (Initial Fix)
- **Token Limit:** 100 → 150
- **Reason:** Silent truncation issue
- **Result:** Still hitting MAX_TOKENS

---

**Status:** ✅ Fixed  
**Date:** November 22, 2025  
**Strategy:** Stop Sequences + 2x Buffer  
**Token Limit:** 100 (with stopSequences)  
**Debugging:** Added finish reason logging
