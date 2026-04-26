import { existsSync, readFileSync, writeFileSync } from 'fs';
import {
  getNextLesson,
  formatLessonForCoach,
  getLessonsForInstrument,
  type Lesson,
} from '../data/curriculum.js';

const DB_PATH = './progress.json';

interface ProgressDB {
  sessions: SessionSummary[];
  skills: SkillRecord[];
}

interface SkillRecord {
  userId: string;
  skillId: string;
  passed: boolean;
  notes: string;
  timestamp: number;
}

function loadDB(): ProgressDB {
  if (existsSync(DB_PATH)) {
    return JSON.parse(readFileSync(DB_PATH, 'utf-8'));
  }
  return { sessions: [], skills: [] };
}

function saveDB(db: ProgressDB) {
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

console.log('[Progress] ✓ Using local JSON store');

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
  const db = loadDB();
  db.sessions.push(summary);
  saveDB(db);
  console.log(`[Progress] Saved session: ${summary.lessonTitle}`);
}

export async function recordSkillAssessment(
  userId: string,
  skillId: string,
  _skillName: string,
  passed: boolean,
  notes: string
): Promise<void> {
  const db = loadDB();
  db.skills.push({ userId, skillId, passed, notes, timestamp: Date.now() });
  saveDB(db);
}

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
  const db = loadDB();

  const userSessions = db.sessions.filter((s) => s.userId === userId && s.instrument === instrument);
  const userSkills = db.skills.filter((s) => s.userId === userId);

  const passedSkills = [...new Set(userSkills.filter((s) => s.passed).map((s) => s.skillId))];
  const failedSkills = [...new Set(userSkills.filter((s) => !s.passed).map((s) => s.skillId))];
  const weakSkills = failedSkills.filter((s) => !passedSkills.includes(s));

  const completedLessons = [...new Set(
    userSessions.filter((s) => s.skillsPassed.length > 0).map((s) => s.lessonId)
  )];

  const recentHistory = userSessions
    .slice(-5)
    .map((s) => `${s.lessonTitle}: passed ${s.skillsPassed.join(',')||'none'}, needs work ${s.skillsNeedWork.join(',')||'none'}`)
    .join('\n');

  const nextLesson = getNextLesson(instrument, completedLessons);
  const allLessons = getLessonsForInstrument(instrument);
  const totalSessions = userSessions.length;

  let coachBriefing: string;
  if (totalSessions === 0) {
    coachBriefing = `NEW STUDENT starting ${instrument}. Welcome them warmly.\n\n` +
      (nextLesson ? formatLessonForCoach(nextLesson) : '');
  } else {
    const pct = Math.round((completedLessons.length / allLessons.length) * 100);
    coachBriefing = `RETURNING STUDENT — ${totalSessions} sessions, ${pct}% complete.\n` +
      `Mastered: ${passedSkills.join(', ') || 'none'}\nWeak: ${weakSkills.join(', ') || 'none'}\n` +
      `Recent:\n${recentHistory}\n\n` +
      (nextLesson ? formatLessonForCoach(nextLesson) : 'All done! Refine skills.');
  }

  return { userId, instrument, completedLessons, passedSkills, weakSkills, totalSessions, recentHistory, nextLesson, coachBriefing };
}
