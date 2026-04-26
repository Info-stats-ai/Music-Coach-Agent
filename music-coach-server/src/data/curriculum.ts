/**
 * Structured curriculum for instrument coaching.
 * Each instrument has levels → lessons → skills.
 * The coach uses this to plan sessions and track progress.
 */

export interface Skill {
  id: string;
  name: string;
  description: string;
  checkpoints: string[]; // observable criteria the coach can verify
  poseHints: string[];   // what to look for in pose/hand data
}

export interface Lesson {
  id: string;
  title: string;
  level: number;
  order: number;
  instrument: string;
  description: string;
  skills: Skill[];
  prerequisites: string[]; // lesson IDs that must be completed first
  estimatedMinutes: number;
}

export const CURRICULUM: Lesson[] = [
  // ─── GUITAR: Level 1 — Absolute Beginner ───
  {
    id: 'guitar-1-1',
    title: 'Holding the Guitar',
    level: 1, order: 1,
    instrument: 'guitar',
    description: 'Learn the correct way to hold and sit with a guitar. Foundation for everything else.',
    prerequisites: [],
    estimatedMinutes: 15,
    skills: [
      {
        id: 'guitar-posture',
        name: 'Seated Posture',
        description: 'Sit upright with guitar resting on right thigh (classical) or left thigh, back straight.',
        checkpoints: ['Shoulders level (tilt < 5°)', 'Back straight (posture score > 80)', 'Guitar neck angled upward ~45°'],
        poseHints: ['shoulderAngle < 5', 'postureScore > 80'],
      },
      {
        id: 'guitar-left-hand-position',
        name: 'Left Hand Position',
        description: 'Thumb behind neck, fingers curved, fingertips pressing strings.',
        checkpoints: ['Thumb behind neck center', 'Fingers curved (curl > 0.3 for all)', 'Wrist not bent excessively'],
        poseHints: ['left hand fingerCurl > 0.3', 'wristAngle between 75-105'],
      },
      {
        id: 'guitar-right-hand-position',
        name: 'Right Hand Position',
        description: 'Right hand resting near sound hole, relaxed wrist for strumming.',
        checkpoints: ['Hand near sound hole height', 'Wrist relaxed', 'Fingers slightly curved'],
        poseHints: ['right hand position near body center', 'fingerSpread moderate'],
      },
    ],
  },
  {
    id: 'guitar-1-2',
    title: 'Basic Chord: E Minor',
    level: 1, order: 2,
    instrument: 'guitar',
    description: 'Learn your first chord — E minor. Only 2 fingers needed.',
    prerequisites: ['guitar-1-1'],
    estimatedMinutes: 20,
    skills: [
      {
        id: 'guitar-em-finger-placement',
        name: 'Em Finger Placement',
        description: 'Place middle finger on 5th string 2nd fret, ring finger on 4th string 2nd fret.',
        checkpoints: ['Two fingers pressing down', 'Other fingers lifted', 'Clean sound when strummed'],
        poseHints: ['left hand: middle and ring curl > 0.5, index and pinky curl < 0.3'],
      },
      {
        id: 'guitar-basic-strum',
        name: 'Basic Downstroke Strum',
        description: 'Strum all 6 strings with a smooth downward motion.',
        checkpoints: ['Even strum across strings', 'Consistent rhythm', 'Relaxed right wrist'],
        poseHints: ['right hand vertical motion detected', 'wrist relaxed'],
      },
    ],
  },
  {
    id: 'guitar-1-3',
    title: 'Basic Chord: A Minor',
    level: 1, order: 3,
    instrument: 'guitar',
    description: 'Learn A minor chord — builds on finger independence from Em.',
    prerequisites: ['guitar-1-2'],
    estimatedMinutes: 20,
    skills: [
      {
        id: 'guitar-am-finger-placement',
        name: 'Am Finger Placement',
        description: 'Index on 2nd string 1st fret, middle on 4th string 2nd fret, ring on 3rd string 2nd fret.',
        checkpoints: ['Three fingers pressing correctly', 'First string rings open', 'No buzzing'],
        poseHints: ['left hand: index, middle, ring curl > 0.4'],
      },
      {
        id: 'guitar-chord-transition-em-am',
        name: 'Em → Am Transition',
        description: 'Switch between Em and Am smoothly within 4 beats.',
        checkpoints: ['Transition under 2 seconds', 'Both chords sound clean', 'Minimal hand lift'],
        poseHints: ['hand position change detected', 'finger curl pattern changes'],
      },
    ],
  },
  {
    id: 'guitar-1-4',
    title: 'Basic Chord: C Major',
    level: 1, order: 4,
    instrument: 'guitar',
    description: 'C major — the most important open chord. Requires good finger stretch.',
    prerequisites: ['guitar-1-3'],
    estimatedMinutes: 25,
    skills: [
      {
        id: 'guitar-c-finger-placement',
        name: 'C Major Finger Placement',
        description: 'Index 2nd string 1st fret, middle 4th string 2nd fret, ring 5th string 3rd fret.',
        checkpoints: ['Three fingers spanning 3 frets', 'Good finger arch', 'Strings ring clearly'],
        poseHints: ['left hand fingerSpread > 0.05', 'all three fingers curled'],
      },
    ],
  },
  {
    id: 'guitar-1-5',
    title: 'Basic Chord: G Major',
    level: 1, order: 5,
    instrument: 'guitar',
    description: 'G major — completes the beginner chord set for hundreds of songs.',
    prerequisites: ['guitar-1-4'],
    estimatedMinutes: 25,
    skills: [
      {
        id: 'guitar-g-finger-placement',
        name: 'G Major Finger Placement',
        description: 'Middle on 5th string 2nd fret, index on 6th string 2nd fret, ring/pinky on 1st/2nd string 3rd fret.',
        checkpoints: ['Wide finger spread across fretboard', 'All strings ring', 'Pinky engaged'],
        poseHints: ['left hand fingerSpread high', 'pinky curl > 0.4'],
      },
      {
        id: 'guitar-4-chord-progression',
        name: 'Em-Am-C-G Progression',
        description: 'Play all four chords in sequence with steady rhythm.',
        checkpoints: ['All transitions under 2 seconds', 'Steady tempo', 'Clean chord sounds'],
        poseHints: ['consistent strumming rhythm', 'smooth hand transitions'],
      },
    ],
  },

  // ─── GUITAR: Level 2 — Beginner ───
  {
    id: 'guitar-2-1',
    title: 'Strumming Patterns',
    level: 2, order: 1,
    instrument: 'guitar',
    description: 'Learn down-up strumming patterns and basic rhythm.',
    prerequisites: ['guitar-1-5'],
    estimatedMinutes: 30,
    skills: [
      {
        id: 'guitar-down-up-strum',
        name: 'Down-Up Strumming',
        description: 'Alternate between downstrokes and upstrokes evenly.',
        checkpoints: ['Even down-up motion', 'Consistent tempo', 'Wrist-driven (not arm)'],
        poseHints: ['right wrist oscillation detected', 'elbow relatively stable'],
      },
      {
        id: 'guitar-rhythm-pattern-1',
        name: 'D-DU-UDU Pattern',
        description: 'The most common strumming pattern in pop music.',
        checkpoints: ['Correct accent on beats 1 and 3', 'Muted upstrokes lighter', 'Steady tempo'],
        poseHints: ['rhythmic right hand motion', 'varying strum intensity'],
      },
    ],
  },
  {
    id: 'guitar-2-2',
    title: 'Fingerpicking Basics',
    level: 2, order: 2,
    instrument: 'guitar',
    description: 'Introduction to fingerpicking — thumb, index, middle, ring assignment.',
    prerequisites: ['guitar-2-1'],
    estimatedMinutes: 30,
    skills: [
      {
        id: 'guitar-finger-assignment',
        name: 'PIMA Finger Assignment',
        description: 'Thumb (P) on bass strings 4-6, Index (I) on 3rd, Middle (M) on 2nd, Ring (A) on 1st.',
        checkpoints: ['Each finger assigned to correct string', 'Fingers curved', 'Thumb separate from fingers'],
        poseHints: ['right hand fingers spread', 'individual finger movement detected'],
      },
      {
        id: 'guitar-basic-arpeggio',
        name: 'Basic Arpeggio Pattern',
        description: 'Play P-I-M-A pattern across a chord.',
        checkpoints: ['Sequential finger plucking', 'Even volume per string', 'Steady tempo'],
        poseHints: ['sequential finger curl changes in right hand'],
      },
    ],
  },

  // ─── GUITAR: Level 3 — Intermediate ───
  {
    id: 'guitar-3-1',
    title: 'Barre Chords',
    level: 3, order: 1,
    instrument: 'guitar',
    description: 'Learn F major barre chord — the gateway to playing in any key.',
    prerequisites: ['guitar-2-2'],
    estimatedMinutes: 40,
    skills: [
      {
        id: 'guitar-barre-technique',
        name: 'Index Finger Barre',
        description: 'Lay index finger flat across all 6 strings at a fret.',
        checkpoints: ['Index finger flat and straight', 'All strings pressed evenly', 'Thumb behind neck for support'],
        poseHints: ['left index finger curl near 0 (flat)', 'strong thumb pressure'],
      },
      {
        id: 'guitar-f-major',
        name: 'F Major Barre Chord',
        description: 'Full F major barre at 1st fret.',
        checkpoints: ['All 6 strings ring clearly', 'No buzzing', 'Can hold for 8 beats'],
        poseHints: ['left hand: index flat, other fingers curled at fret 2-3'],
      },
    ],
  },

  // ─── PIANO: Level 1 ───
  {
    id: 'piano-1-1',
    title: 'Hand Position & Posture',
    level: 1, order: 1,
    instrument: 'piano',
    description: 'Correct seated posture and hand position on the keyboard.',
    prerequisites: [],
    estimatedMinutes: 15,
    skills: [
      {
        id: 'piano-posture',
        name: 'Seated Posture',
        description: 'Sit at edge of bench, feet flat, elbows slightly above key level.',
        checkpoints: ['Back straight', 'Shoulders relaxed and level', 'Elbows at ~90°'],
        poseHints: ['postureScore > 80', 'shoulderAngle < 5', 'elbowAngle near 90'],
      },
      {
        id: 'piano-curved-fingers',
        name: 'Curved Finger Position',
        description: 'Fingers curved as if holding a ball, fingertips on keys.',
        checkpoints: ['All fingers curved', 'Wrist level (not dropped)', 'Thumb on side'],
        poseHints: ['both hands fingerCurl between 0.3-0.6', 'wrist level'],
      },
    ],
  },
  {
    id: 'piano-1-2',
    title: 'C Major Scale (Right Hand)',
    level: 1, order: 2,
    instrument: 'piano',
    description: 'Play C-D-E-F-G-A-B-C with correct fingering (1-2-3-1-2-3-4-5).',
    prerequisites: ['piano-1-1'],
    estimatedMinutes: 20,
    skills: [
      {
        id: 'piano-thumb-under',
        name: 'Thumb Under Technique',
        description: 'Pass thumb under fingers smoothly at F (after E with finger 3).',
        checkpoints: ['Smooth thumb crossing', 'No wrist rotation', 'Even tempo maintained'],
        poseHints: ['right hand thumb curl changes during crossing'],
      },
    ],
  },
];

/**
 * Get lessons for a specific instrument, ordered by level and sequence.
 */
export function getLessonsForInstrument(instrument: string): Lesson[] {
  return CURRICULUM
    .filter((l) => l.instrument === instrument)
    .sort((a, b) => a.level - b.level || a.order - b.order);
}

/**
 * Get the next recommended lesson based on completed lesson IDs.
 */
export function getNextLesson(instrument: string, completedLessonIds: string[]): Lesson | null {
  const lessons = getLessonsForInstrument(instrument);
  for (const lesson of lessons) {
    if (completedLessonIds.includes(lesson.id)) continue;
    const prereqsMet = lesson.prerequisites.every((p) => completedLessonIds.includes(p));
    if (prereqsMet) return lesson;
  }
  return null; // all lessons completed
}

/**
 * Format a lesson into a coaching prompt context block.
 */
export function formatLessonForCoach(lesson: Lesson): string {
  const skills = lesson.skills
    .map((s) => `  - ${s.name}: ${s.description}\n    Check: ${s.checkpoints.join(', ')}`)
    .join('\n');

  return `TODAY'S LESSON: ${lesson.title} (Level ${lesson.level})
${lesson.description}
Estimated time: ${lesson.estimatedMinutes} minutes

Skills to teach:
${skills}`;
}
