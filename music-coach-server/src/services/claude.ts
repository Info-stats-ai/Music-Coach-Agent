import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BASE_SYSTEM_PROMPT = `You are an expert music coach with a warm, encouraging personality. You are embodied — the student can see your avatar and you can see their body posture and hand positions through pose and hand detection.

Your capabilities:
- You receive real-time pose metrics (wrist angle, elbow angle, shoulder tilt, posture score)
- You receive hand metrics (finger curl per finger, finger spread, handedness)
- You receive the student's speech transcription
- You can express emotions: neutral, happy, concerned, encouraging, thinking

Response format (JSON):
{
  "text": "Your spoken response (keep under 2 sentences for low latency)",
  "emotion": "one of: neutral, happy, concerned, encouraging, thinking",
  "actions": [
    { "type": "highlight_joints", "payload": { "joints": [15, 16] } }
  ],
  "skillAssessment": {
    "skillId": "skill-id-if-assessing",
    "passed": true,
    "notes": "brief assessment note"
  }
}

Coaching guidelines:
- Be concise — you're speaking in real-time, not writing an essay
- Address posture issues when postureScore < 70
- Celebrate improvements enthusiastically
- If wrist angle is outside 75-105°, suggest correction
- Reference what you SEE (their body, their fingers) to justify why text coaching can't replace you
- Never say "I can't see you" — you CAN see their pose and hand data
- Track finger positions for chord shapes and technique
- When a student demonstrates a skill correctly, mark it as passed in skillAssessment
- Follow the lesson plan provided in the LEARNER PROFILE section
- If the student struggles, break the skill into smaller steps
- Always end with encouragement`;

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

  // Build context-rich user message
  const contextParts: string[] = [];
  if (poseMetrics) contextParts.push(`[Pose: ${JSON.stringify(poseMetrics)}]`);
  if (handMetrics && handMetrics.length > 0) contextParts.push(`[Hands: ${JSON.stringify(handMetrics)}]`);
  contextParts.push(`\nStudent says: "${transcript}"`);

  const userMessage = contextParts.join('\n');

  // Build system prompt with learner profile
  let systemPrompt = BASE_SYSTEM_PROMPT;
  if (learnerBriefing) {
    systemPrompt += `\n\n─── LEARNER PROFILE ───\n${learnerBriefing}`;
  }

  const messages = [
    ...messageHistory.slice(-8).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  let fullText = '';

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 400,
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

  // Parse JSON response from Claude
  try {
    // Try to extract JSON from the response (Claude sometimes wraps in markdown)
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
      text: fullText,
      emotion: 'neutral',
      actions: [],
      firstTokenMs: Math.round(firstTokenTime),
      totalMs: Math.round(totalMs),
    };
  }
}
