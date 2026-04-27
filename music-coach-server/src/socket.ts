import { Server, Socket } from 'socket.io';
import { v4 as uuid } from 'uuid';
import { createLiveTranscription } from './services/deepgram.js';
import { streamCoachResponse } from './services/claude.js';
import { streamTTS } from './services/elevenlabs.js';
import { getSession, saveSession, type SessionData } from './services/redis.js';
import {
  getLearnerProfile,
  recordSessionProgress,
  recordSkillAssessment,
} from './services/progress.js';

interface PoseUpdate {
  landmarks: Array<{ x: number; y: number; z: number; visibility: number }>;
  metrics: Record<string, unknown>;
  timestamp: number;
}

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    const sessionId = uuid();
    const userId = `user_${socket.handshake.query.userId || 'default'}`;
    console.log(`[Socket] Connected: ${socket.id} (user: ${userId})`);

    let session: SessionData = {
      sessionId,
      startedAt: Date.now(),
      messageHistory: [],
      poseHistory: [],
    };

    let latestPoseMetrics: Record<string, unknown> | null = null;
    let latestHandMetrics: Record<string, unknown>[] = [];
    let isProcessing = false;
    let learnerBriefing = '';
    let currentInstrument = ''; // empty = not chosen yet, coach will ask
    let currentLessonId = '';
    let skillsPassed: string[] = [];
    let skillsNeedWork: string[] = [];
    const sessionStartTime = Date.now();

    // ─── Load learner profile (deferred until instrument is chosen) ───
    const loadProfile = async (instrument: string) => {
      currentInstrument = instrument;
      try {
        const profile = await getLearnerProfile(userId, instrument);
        learnerBriefing = profile.coachBriefing;
        currentLessonId = profile.nextLesson?.id || '';
        console.log(`[RAG] Profile for ${instrument}: ${profile.totalSessions} sessions, next=${currentLessonId}`);

        socket.emit('learner_profile', {
          totalSessions: profile.totalSessions,
          completedLessons: profile.completedLessons.length,
          passedSkills: profile.passedSkills,
          weakSkills: profile.weakSkills,
          nextLesson: profile.nextLesson
            ? { id: profile.nextLesson.id, title: profile.nextLesson.title, level: profile.nextLesson.level }
            : null,
          instrument,
        });
      } catch (err) {
        console.warn('[RAG] Profile load failed:', err);
        learnerBriefing = `NEW STUDENT wants to learn ${instrument}. Welcome them and start teaching!`;
      }
    };

    // Don't load profile yet — wait for instrument selection
    socket.emit('learner_profile', {
      totalSessions: 0,
      completedLessons: 0,
      passedSkills: [],
      weakSkills: [],
      nextLesson: null,
      instrument: '',
    });
    // Restore session
    (async () => {
      const existing = await getSession(sessionId);
      if (existing) session = existing;
    })();

    // ─── Deepgram STT with debounce ───
    let pendingTranscript = '';
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const processTranscript = async () => {
      if (isProcessing || !pendingTranscript.trim()) return;

      isProcessing = true;
      const fullTranscript = pendingTranscript.trim();
      pendingTranscript = '';
      const pipelineStart = performance.now();

      try {
        // Auto-detect instrument from speech
        const instruments = ['guitar', 'piano', 'violin', 'drums', 'bass', 'ukulele', 'flute', 'saxophone', 'cello', 'trumpet', 'harmonica', 'banjo', 'mandolin', 'clarinet', 'trombone', 'harp', 'sitar', 'tabla'];
        const lower = fullTranscript.toLowerCase();
        for (const inst of instruments) {
          if (lower.includes(inst) && (lower.includes('learn') || lower.includes('teach') || lower.includes('play') || lower.includes('practice') || lower.includes('want') || lower.includes('switch') || currentInstrument === '')) {
            if (inst !== currentInstrument) {
              console.log(`[Instrument] Detected "${inst}" from speech`);
              await loadProfile(inst);
            }
            break;
          }
        }

        // If no instrument chosen yet, set briefing to ask
        if (!currentInstrument) {
          learnerBriefing = 'The student has NOT chosen an instrument yet. Ask them: "What instrument would you like to learn today?"';
        }

        socket.emit('user_transcript', { text: fullTranscript });
        session.messageHistory.push({ role: 'user', content: fullTranscript });

        // Claude inference with RAG context
        const coachResult = await streamCoachResponse(
          fullTranscript,
          latestPoseMetrics,
          latestHandMetrics.length > 0 ? latestHandMetrics : null,
          session.messageHistory,
          learnerBriefing
        );

        session.messageHistory.push({ role: 'assistant', content: coachResult.text });

        // Track skill assessments
        if (coachResult.skillAssessment) {
          const { skillId, passed, notes } = coachResult.skillAssessment;
          await recordSkillAssessment(userId, skillId, skillId, passed, notes);
          if (passed) skillsPassed.push(skillId);
          else skillsNeedWork.push(skillId);
          console.log(`[Skill] ${skillId}: ${passed ? 'PASSED ✓' : 'NEEDS WORK ✗'}`);
        }

        // TTS → ONLY PCM to SpatialReal. No browser playback.
        socket.emit('tts_start');
        const ttsResult = await streamTTS(
          coachResult.text,
          (pcmChunk, isFinal) => {
            socket.emit(isFinal ? 'tts_pcm_final' : 'tts_pcm_chunk', pcmChunk);
          },
          () => {
            // WAV not used — SpatialReal handles audio playback
          }
        );
        socket.emit('tts_end');

        // If ElevenLabs failed, use browser TTS
        if (ttsResult.usedFallback) {
          socket.emit('use_browser_tts', { text: coachResult.text });
        }

        const totalMs = Math.round(performance.now() - pipelineStart);

        socket.emit('coach_response', {
          text: coachResult.text,
          emotion: coachResult.emotion,
          actions: coachResult.actions,
          latency: {
            sttMs: 0,
            llmFirstTokenMs: coachResult.firstTokenMs,
            llmTotalMs: coachResult.totalMs,
            ttsFirstChunkMs: ttsResult.firstChunkMs,
            totalMs,
          },
        });

        socket.emit('expression_change', { emotion: coachResult.emotion });

        for (const action of coachResult.actions) {
          if (action.type === 'highlight_joints' || action.type === 'show_pose_correction') {
            socket.emit('show_pose_correction', action.payload);
          }
        }

        await saveSession(session);
        console.log(`[Pipeline] LLM=${coachResult.totalMs}ms TTS=${ttsResult.totalMs}ms Total=${totalMs}ms`);
      } catch (err) {
        console.error('[Pipeline] Error:', err);
        socket.emit('coach_error', { message: err instanceof Error ? err.message : 'Pipeline error' });
      } finally {
        isProcessing = false;
      }
    };

    const stt = createLiveTranscription(
      (result) => {
        if (!result.text.trim()) return;

        if (!result.isFinal) {
          socket.emit('user_transcript_interim', { text: result.text });
          return;
        }

        // Accumulate final segments, debounce 1.5s before responding
        pendingTranscript += (pendingTranscript ? ' ' : '') + result.text;
        console.log(`[STT] Final: "${result.text}" (pending: "${pendingTranscript}")`);

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(processTranscript, 1500);
      },
      (err) => {
        console.error('[STT] Error:', err.message);
        socket.emit('stt_error', { message: err.message });
      }
    );

    // ─── Audio from client → Deepgram ───
    let audioChunkCount = 0;
    socket.on('audio_chunk', (chunk: ArrayBuffer) => {
      audioChunkCount++;
      if (audioChunkCount === 1) {
        console.log(`[Socket] First audio chunk from ${socket.id} (${chunk.byteLength}b)`);
      }
      stt.send(chunk);
    });

    // ─── Pose & Hand updates ───
    socket.on('pose_update', (data: PoseUpdate) => {
      latestPoseMetrics = data.metrics;
      session.poseHistory = [...session.poseHistory.slice(-9), data.metrics];
    });

    socket.on('hand_update', (data: Record<string, unknown>[]) => {
      latestHandMetrics = data;
    });

    socket.on('set_instrument', async (instrument: string) => {
      await loadProfile(instrument);
      console.log(`[Session] Instrument set to ${instrument}`);
    });

    // ─── Disconnect: save progress ───
    socket.on('disconnect', async () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
      if (debounceTimer) clearTimeout(debounceTimer);
      stt.close();

      const durationMinutes = Math.round((Date.now() - sessionStartTime) / 60000);
      if (session.messageHistory.length > 0) {
        await recordSessionProgress({
          userId,
          instrument: currentInstrument,
          lessonId: currentLessonId,
          lessonTitle: currentLessonId || 'Free practice',
          skillsWorkedOn: [...new Set([...skillsPassed, ...skillsNeedWork])],
          skillsPassed: [...new Set(skillsPassed)],
          skillsNeedWork: [...new Set(skillsNeedWork)],
          coachNotes: `Session lasted ${durationMinutes} min with ${session.messageHistory.length} exchanges.`,
          sessionDurationMinutes: durationMinutes,
          timestamp: Date.now(),
        });
        console.log(`[Progress] Saved: ${skillsPassed.length} passed, ${skillsNeedWork.length} need work`);
      }

      await saveSession(session);
    });
  });
}
