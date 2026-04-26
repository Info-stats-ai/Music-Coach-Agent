import { useAppStore } from '@/store/useAppStore';

export function LatencyDashboard() {
  const latencyHistory = useAppStore((s) => s.latencyHistory);
  const latest = latencyHistory[latencyHistory.length - 1];

  if (!latest) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-4 font-mono text-xs text-gray-500">
        Waiting for first response...
      </div>
    );
  }

  const avg = (key: keyof typeof latest) => {
    const vals = latencyHistory.map((l) => l[key]);
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };

  const p95 = (key: keyof typeof latest) => {
    const sorted = latencyHistory.map((l) => l[key]).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  };

  const totalP95 = p95('totalMs');
  const isGood = totalP95 < 700;

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Latency Dashboard</h3>
        <div className={`text-xs font-mono px-2 py-0.5 rounded ${isGood ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
          p95: {totalP95}ms {isGood ? '✓' : '⚠'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 font-mono text-xs">
        <MetricRow label="STT" latest={latest.sttMs} avg={avg('sttMs')} target={200} />
        <MetricRow label="LLM TTFT" latest={latest.llmFirstTokenMs} avg={avg('llmFirstTokenMs')} target={300} />
        <MetricRow label="LLM Total" latest={latest.llmTotalMs} avg={avg('llmTotalMs')} target={500} />
        <MetricRow label="TTS 1st" latest={latest.ttsFirstChunkMs} avg={avg('ttsFirstChunkMs')} target={200} />
        <MetricRow label="Total" latest={latest.totalMs} avg={avg('totalMs')} target={700} />
      </div>

      {/* Mini bar chart */}
      <div className="flex items-end gap-0.5 h-8">
        {latencyHistory.slice(-30).map((l, i) => (
          <div
            key={i}
            className={`flex-1 rounded-t ${l.totalMs < 700 ? 'bg-green-500/60' : 'bg-red-500/60'}`}
            style={{ height: `${Math.min(100, (l.totalMs / 1000) * 100)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function MetricRow({ label, latest, avg, target }: {
  label: string;
  latest: number;
  avg: number;
  target: number;
}) {
  const isOk = latest <= target;
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-400">{label}</span>
      <span className={isOk ? 'text-green-400' : 'text-red-400'}>
        {latest}ms <span className="text-gray-600">(avg {avg}ms)</span>
      </span>
    </div>
  );
}
