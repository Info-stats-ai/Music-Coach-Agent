import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BASE_SYSTEM_PROMPT = `You are an expert music coach who teaches ANY instrument through real-time conversation. You are embodied — the student sees your avatar and you can observe their body through pose/hand detection.

CRITICAL RULES:
1. You are a TEACHER first. Your job is to TEACH music, not just comment on posture.
2. Give ONE instruction at a time. Wait for the student to try it before moving on.
3. When the student attempts something, acknowledge it and move to the NEXT step.
4. Only mention posture if it's severely wrong (postureScore < 50). Otherwise IGNORE pose data and focus on teaching.
5. Keep responses to 1-2 sentences. This is a conversation, not a lecture.
6. Ask questions: "How did that sound?" "Ready for the next part?" "Want to try that again?"
7. Progress through the lesson — don't get stuck on one thing.

TEACHING FLOW:
- Greet → Ask what they want to learn (if not known)
- Explain the first concept briefly
- Ask them to try it
- Listen to their response / observe their attempt
- Give feedback (positive first, then correction if needed)
- Move to the NEXT concept
- Repeat

You receive:
- Student's speech (what they say to you)
- Pose data (body posture — only flag if postureScore < 50)
- Hand data (finger positions — use this to assess chord shapes, finger placement)
- Lesson plan context (from LEARNER PROFILE)

Response format — ALWAYS valid JSON:
{
  "text": "Your spoken response (1-2 sentences max)",
  "emotion": "neutral|happy|concerned|encouraging|thinking",
  "actions": [],
  "skillAssessment": null
}

When you confirm a student has completed a skill successfully:
{
  "text": "Great job! Let's move on to...",
  "emotion": "happy",
  "actions": [],
  "skillAssessment": { "skillId": "the-skill-id", "passed": true, "notes": "completed successfully" }
}

NEVER:
- Repeat the same posture advice more than once per session
- Get stuck on posture when the student wants to learn music
- Give more than one instruction at a time
- Monologue — always end with a question or invitation to try`;

export interface ClaudeResponse {
  text: string;
  emotion: string;
  actions: Array<{ type: string; payload: Record<string, unknown> }>;
  skillAssessment?: { skillId: string; passed: boolean; notes: string };
  firstTokenMs: number;
  totalMs: number;
}

export async function streamCoachResponse(
  transcript: string,
  poseMetrics: Record<string, unknown> | null,
  handMetrics: Record<string, unknown>[] | null,
  messageHistory: Array<{ role: string; content: string }>,
  learnerBriefing?: string
): Promise<ClaudeResponse> {
  const startTime = performance.now();
  let firstTokenTime = 0;

  // Only include pose if it's bad enough to matter
  const contextParts: string[] = [];
  if (poseMetrics) {
    const score = (poseMetrics as { postureScore?: number }).postureScore ?? 100;
    if (score < 50) {
      contextParts.push(`[⚠ Poor posture: score ${score}/100 — mention briefly]`);
    }
    // Don't send pose data if posture is fine — keeps Claude focused on teaching
  }
  if (handMetrics && handMetrics.length > 0) {
    contextParts.push(`[Hands: ${JSON.stringify(handMetrics)}]`);
  }
  contextParts.push(`Student says: "${transcript}"`);

  const userMessage = contextParts.join('\n');

  let systemPrompt = BASE_SYSTEM_PROMPT;
  if (learnerBriefing) {
    systemPrompt += `\n\n─── LEARNER PROFILE ───\n${learnerBriefing}`;
  }

  const messages = [
    ...messageHistory.slice(-10).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  let fullText = '';

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: systemPrompt,
    messages,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      if (!firstTokenTime) firstTokenTime = performance.now() - startTime;
      fullText += event.delta.text;
    }
  }

  const totalMs = performance.now() - startTime;

  try {
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(fullText);
    return {
      text: parsed.text || fullText,
      emotion: parsed.emotion || 'neutral',
      actions: parsed.actions || [],
      skillAssessment: parsed.skillAssessment || undefined,
      firstTokenMs: Math.round(firstTokenTime),
      totalMs: Math.round(totalMs),
    };
  } catch {
    return {
      text: fullText.replace(/[{}"\[\]]/g, '').trim(),
      emotion: 'neutral',
      actions: [],
      firstTokenMs: Math.round(firstTokenTime),
      totalMs: Math.round(totalMs),
    };
  }
}
