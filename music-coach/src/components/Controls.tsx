import { useRealtimeCoach } from '@/hooks/useRealtimeCoach';

export function Controls() {
  const { startListening, stopListening, isConnected, isListening } = useRealtimeCoach();

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
        <span className="text-xs text-gray-400 font-mono">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <button
        onClick={isListening ? stopListening : startListening}
        disabled={!isConnected}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          isListening
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {isListening ? '⏹ Stop' : '🎤 Start Coaching'}
      </button>
    </div>
  );
}
