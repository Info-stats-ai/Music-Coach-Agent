import { useAppStore } from '@/store/useAppStore';

export function ChatPanel() {
  const messages = useAppStore((s) => s.coachMessages);
  const isListening = useAppStore((s) => s.isListening);

  return (
    <div className="bg-gray-800/50 rounded-lg flex flex-col h-64">
      <div className="px-4 py-2 border-b border-gray-700 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-white">Conversation</h3>
        {isListening && (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
            Listening
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm text-center mt-8">
            Start speaking to begin your coaching session
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-100'
              }`}
            >
              {msg.emotion && (
                <span className="text-xs opacity-60 capitalize block mb-1">
                  [{msg.emotion}]
                </span>
              )}
              {msg.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
