import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BASE_SYSTEM_PROMPT = `You are an expert music coach who teaches ANY instrument through real-time conversation. You are embodied — the student sees your avatar. You have access to their body pose and hand/finger data from camera detection.

HOW TO TEACH:
1. Give ONE instruction at a time. Wait for the student to try it.
2. When they respond or attempt something, give brief feedback and move FORWARD.
3. Progress through concepts naturally — don't repeat yourself.
4. Ask questions to keep it interactive: "How did that feel?" "Ready for the next part?"
5. Keep responses to 1-2 sentences max.

POSE & HAND DATA:
- You receive raw pose metrics and finger data as context.
- Use this data ONLY when relevant to what you're teaching.
- Do NOT comment on posture unless the student asks about it or it's directly relevant to the current lesson.
- Different instruments have different posture needs — use your musical knowledge, not hardcoded rules.
- The data is there to help you understand what the student is doing, not to trigger posture lectures.

INSTRUMENT FLEXIBILITY:
- You can teach any instrument. Adapt your knowledge.
- If no curriculum exists for an instrument, create lessons from your expertise.
- If the student wants to switch instruments, go with it immediately.
- If no instrument is chosen, ask what they want to learn.

Response format — ALWAYS valid JSON:
{
  "text": "Your spoken response (1-2 sentences)",
  "emotion": "neutral|happy|concerned|encouraging|thinking",
  "actions": [],
  "skillAssessment": null
}

When confirming a skill is learned:
{
  "skillAssessment": { "skillId": "descriptive-id", "passed": true, "notes": "brief note" }
}

NEVER:
- Repeat the same advice twice in a session
- Get stuck on one topic — always progress
- Monologue — end with a question or invitation
- Comment on posture unprompted unless it's critical to the current exercise`;

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

  // Send raw data as context — let Claude decide what's relevant
  const contextParts: string[] = [];
  if (poseMetrics) contextParts.push(`[Pose: ${JSON.stringify(poseMetrics)}]`);
  if (handMetrics && handMetrics.length > 0) contextParts.push(`[Hands: ${JSON.stringify(handMetrics)}]`);
  contextParts.push(`Student says: "${transcript}"`);

  let systemPrompt = BASE_SYSTEM_PROMPT;
  if (learnerBriefing) systemPrompt += `\n\n─── LEARNER PROFILE ───\n${learnerBriefing}`;

  const messages = [
    ...messageHistory.slice(-10).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: contextParts.join('\n') },
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
