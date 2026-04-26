import { ChromaClient, Collection } from 'chromadb';
import { v4 as uuid } from 'uuid';
import {
  getNextLesson,
  formatLessonForCoach,
  getLessonsForInstrument,
  type Lesson,
} from '../data/curriculum.js';

const chroma = new ChromaClient({ path: 'http://localhost:8000' });

let progressCollection: Collection | null = null;
let skillsCollection: Collection | null = null;

async function ensureCollections() {
  if (progressCollection && skillsCollection) return;

  progressCollection = await chroma.getOrCreateCollection({
    name: 'learning_progress',
    metadata: { description: 'Tracks what the student has learned per session' },
  });

  skillsCollection = await chroma.getOrCreateCollection({
    name: 'skill_assessments',
    metadata: { description: 'Individual skill assessment records' },
  });

  console.log('[Progress] ✓ ChromaDB collections ready');
}

// Initialize on module load
ensureCollections();

// ─── Progress Recording ───

export interface SessionSummary {
  userId: string;
  instrument: string;
  lessonId: string;
  lessonTitle: string;
  skillsWorkedOn: string[];
  skillsPassed: string[];
  skillsNeedWork: string[];
  coachNotes: string;
  sessionDurationMinutes: number;
  timestamp: number;
}

export async function recordSessionProgress(summary: SessionSummary): Promise<void> {
  await ensureCollections();

  const document = `Session on ${new Date(summary.timestamp).toLocaleDateString()}: ` +
    `Lesson "${summary.lessonTitle}" (${summary.instrument}). ` +
    `Skills passed: ${summary.skillsPassed.join(', ') || 'none'}. ` +
    `Needs work: ${summary.skillsNeedWork.join(', ') || 'none'}. ` +
    `Coach notes: ${summary.coachNotes}`;

  const metadata = {
    userId: summary.userId,
    instrument: summary.instrument,
    lessonId: summary.lessonId,
    timestamp: summary.timestamp,
    skillsPassed: JSON.stringify(summary.skillsPassed),
    skillsNeedWork: JSON.stringify(summary.skillsNeedWork),
    durationMinutes: summary.sessionDurationMinutes,
  };

  await progressCollection!.add({
    ids: [uuid()],
    documents: [document],
    metadatas: [metadata],
  });

  console.log(`[Progress] Stored session for ${summary.userId}: ${summary.lessonTitle}`);
}

export async function recordSkillAssessment(
  userId: string,
  skillId: string,
  skillName: string,
  passed: boolean,
  notes: string
): Promise<void> {
  await ensureCollections();

  const document = `Skill "${skillName}" (${skillId}): ${passed ? 'PASSED' : 'NEEDS WORK'}. ${notes}`;
  const metadata = {
    userId,
    skillId,
    passed: passed ? 'true' : 'false',
    timestamp: Date.now(),
  };

  await skillsCollection!.add({
    ids: [uuid()],
    documents: [document],
    metadatas: [metadata],
  });
}

// ─── RAG: Query Progress for Session Planning ───

export interface LearnerProfile {
  userId: string;
  instrument: string;
  completedLessons: string[];
  passedSkills: string[];
  weakSkills: string[];
  totalSessions: number;
  recentHistory: string;
  nextLesson: Lesson | null;
  coachBriefing: string;
}

export async function getLearnerProfile(userId: string, instrument: string): Promise<LearnerProfile> {
  await ensureCollections();

  let completedLessons: string[] = [];
  let passedSkills: string[] = [];
  let weakSkills: string[] = [];
  let totalSessions = 0;
  let recentHistory = '';

  try {
    const results = await progressCollection!.query({
      queryTexts: [`${instrument} learning progress for student`],
      nResults: 20,
      where: { userId },
    });

    if (results.documents?.[0]) {
      totalSessions = results.documents[0].length;
      recentHistory = (results.documents[0] as string[]).slice(-5).join('\n');

      for (const meta of results.metadatas?.[0] || []) {
        if (meta && meta.instrument === instrument) {
          const passed = JSON.parse((meta.skillsPassed as string) || '[]');
          const needWork = JSON.parse((meta.skillsNeedWork as string) || '[]');
          passedSkills.push(...passed);
          weakSkills.push(...needWork);
          if (passed.length > 0) {
            completedLessons.push(meta.lessonId as string);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Progress] Query failed (new user?):', (err as Error).message);
  }

  // Deduplicate
  completedLessons = [...new Set(completedLessons)];
  passedSkills = [...new Set(passedSkills)];
  weakSkills = [...new Set(weakSkills.filter((s) => !passedSkills.includes(s)))];

  const nextLesson = getNextLesson(instrument, completedLessons);
  const allLessons = getLessonsForInstrument(instrument);

  let coachBriefing: string;

  if (totalSessions === 0) {
    coachBriefing = `This is a NEW STUDENT starting ${instrument}. ` +
      `Welcome them warmly and start with the very first lesson.\n\n` +
      (nextLesson ? formatLessonForCoach(nextLesson) : 'No curriculum available.');
  } else {
    const progressPct = Math.round((completedLessons.length / allLessons.length) * 100);

    coachBriefing = `RETURNING STUDENT — ${totalSessions} sessions completed.\n` +
      `Progress: ${completedLessons.length}/${allLessons.length} lessons (${progressPct}%)\n` +
      `Skills mastered: ${passedSkills.join(', ') || 'none yet'}\n` +
      `Skills needing work: ${weakSkills.join(', ') || 'none'}\n\n` +
      `Recent history:\n${recentHistory}\n\n` +
      (weakSkills.length > 0
        ? `PRIORITY: Review weak skills (${weakSkills.join(', ')}) before moving on.\n\n`
        : '') +
      (nextLesson
        ? formatLessonForCoach(nextLesson)
        : 'All lessons completed! Focus on refinement and practice.');
  }

  return {
    userId,
    instrument,
    completedLessons,
    passedSkills,
    weakSkills,
    totalSessions,
    recentHistory,
    nextLesson,
    coachBriefing,
  };
}
