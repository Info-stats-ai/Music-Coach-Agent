import { useAppStore } from '@/store/useAppStore';

export function LearnerPanel() {
  const profile = useAppStore((s) => s.learnerProfile);

  if (!profile) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-4 text-xs text-gray-500 font-mono">
        Loading learner profile...
      </div>
    );
  }

  const isNew = profile.totalSessions === 0;

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">📚 Learning Progress</h3>
        <span className="text-xs font-mono text-indigo-400 capitalize">{profile.instrument}</span>
      </div>

      {isNew ? (
        <div className="text-center py-3">
          <p className="text-yellow-300 text-sm">Welcome, new student! 🎉</p>
          <p className="text-gray-500 text-xs mt-1">Your first lesson is ready</p>
        </div>
      ) : (
        <div className="space-y-2 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-gray-400">Sessions</span>
            <span className="text-white">{profile.totalSessions}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Lessons done</span>
            <span className="text-green-400">{profile.completedLessons}</span>
          </div>

          {profile.passedSkills.length > 0 && (
            <div>
              <span className="text-gray-400">Skills mastered:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {profile.passedSkills.map((s) => (
                  <span key={s} className="bg-green-900/50 text-green-300 px-1.5 py-0.5 rounded text-[10px]">
                    ✓ {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.weakSkills.length > 0 && (
            <div>
              <span className="text-gray-400">Needs practice:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {profile.weakSkills.map((s) => (
                  <span key={s} className="bg-yellow-900/50 text-yellow-300 px-1.5 py-0.5 rounded text-[10px]">
                    ⚡ {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Next lesson */}
      {profile.nextLesson && (
        <div className="bg-indigo-900/30 rounded-lg p-3 border border-indigo-800/50">
          <div className="text-xs text-indigo-400 font-mono">Next lesson</div>
          <div className="text-sm text-white mt-1">{profile.nextLesson.title}</div>
          <div className="text-xs text-gray-500 mt-0.5">Level {profile.nextLesson.level}</div>
        </div>
      )}
    </div>
  );
}
