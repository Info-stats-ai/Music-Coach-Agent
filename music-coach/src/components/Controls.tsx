import { useState } from 'react';
import { useRealtimeCoach } from '@/hooks/useRealtimeCoach';
import { useAppStore } from '@/store/useAppStore';

const INSTRUMENTS = ['guitar', 'piano', 'violin', 'drums', 'bass', 'ukulele', 'flute', 'saxophone'];

export function Controls() {
  const { startListening, stopListening, isConnected, isListening, setInstrument } = useRealtimeCoach();
  const profile = useAppStore((s) => s.learnerProfile);
  const [selectedInstrument, setSelectedInstrument] = useState(profile?.instrument || 'guitar');

  const handleInstrumentChange = (instrument: string) => {
    setSelectedInstrument(instrument);
    setInstrument(instrument);
  };

  return (
    <div className="flex items-center gap-3">
      {/* Instrument selector */}
      <select
        value={selectedInstrument}
        onChange={(e) => handleInstrumentChange(e.target.value)}
        className="bg-gray-800 text-white text-xs rounded-lg px-2 py-2 border border-gray-700 focus:border-indigo-500 outline-none"
      >
        {INSTRUMENTS.map((inst) => (
          <option key={inst} value={inst}>
            {inst.charAt(0).toUpperCase() + inst.slice(1)}
          </option>
        ))}
      </select>

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
