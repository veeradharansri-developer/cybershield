import { useState, useEffect } from 'react';
import apiClient from '../api';
import { Spinner, Badge, Alert } from './UI';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';

interface Props {
  sessionId: string;
  recordId: number;
  onClose: () => void;
}

export default function InvestigateDrawer({ sessionId, recordId, onClose }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    apiClient.explainRecord(sessionId, recordId)
      .then(r => setData(r.data))
      .catch(() => setError('Could not load record explanation.'))
      .finally(() => setLoading(false));
  }, [sessionId, recordId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-lg h-full bg-[#0d1b2e] border-l border-[#1e3a5f] overflow-y-auto shadow-2xl fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1e3a5f] sticky top-0 bg-[#0d1b2e] z-10">
          <div>
            <div className="text-xs text-[#64748b] font-mono">Record #{recordId}</div>
            <h2 className="text-white font-semibold text-sm">Anomaly Explanation</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded border border-[#1e3a5f] text-[#64748b] hover:text-white hover:border-[#00d4ff40]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {loading && <Spinner />}
          {error && <Alert type="error">{error}</Alert>}

          {data && !loading && (
            <>
              {/* Verdict */}
              <div className={`rounded-xl p-4 border ${data.is_anomaly ? 'border-[#ff444430] bg-[#ff444408]' : 'border-[#00ff8830] bg-[#00ff8808]'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {data.is_anomaly ? (
                    <AlertTriangle className="w-5 h-5 text-[#ff4444]" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-[#00ff88]" />
                  )}
                  <span className={`font-bold text-sm ${data.is_anomaly ? 'text-[#ff4444]' : 'text-[#00ff88]'}`}>
                    {data.is_anomaly ? 'STATISTICALLY UNUSUAL TRAFFIC' : 'NORMAL TRAFFIC'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                  <div className="bg-[#0d1b2e] rounded p-2 text-center">
                    <div className="text-[#64748b]">Anomaly Score</div>
                    <div className="text-[#f59e0b] font-bold font-mono">{data.anomaly_score}</div>
                  </div>
                  <div className="bg-[#0d1b2e] rounded p-2 text-center">
                    <div className="text-[#64748b]">Max |Z|</div>
                    <div className="text-[#ff4444] font-bold font-mono">{data.max_abs_z?.toFixed(2) ?? '—'}</div>
                  </div>
                  <div className="bg-[#0d1b2e] rounded p-2 text-center">
                    <div className="text-[#64748b]">IQR Violations</div>
                    <div className="text-[#f59e0b] font-bold font-mono">{data.iqr_violations}</div>
                  </div>
                </div>
                {data.label && (
                  <div className="mt-3 pt-3 border-t border-[#1e3a5f]">
                    <span className="text-xs text-[#64748b]">Dataset Label (Ground Truth): </span>
                    <span className="text-white text-xs font-semibold">{data.label}</span>
                    <p className="text-xs text-[#475569] mt-1">
                      Note: Ground truth labels reflect original dataset annotations and are independent from the statistical classification above.
                    </p>
                  </div>
                )}
              </div>

              {/* Reasons */}
              {data.reasons.length > 0 && (
                <div>
                  <h3 className="text-xs text-[#64748b] uppercase tracking-wider mb-2">Why Was This Flagged?</h3>
                  <div className="space-y-2">
                    {data.reasons.map((r: string, i: number) => (
                      <div key={i} className="flex gap-2 p-2 bg-[#0d1b2e] rounded-lg text-xs text-[#94a3b8]">
                        <span className="text-[#ff4444] shrink-0">⚠</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Feature evidence table */}
              <div>
                <h3 className="text-xs text-[#64748b] uppercase tracking-wider mb-2">Feature-Level Statistical Evidence</h3>
                <div className="space-y-2">
                  {data.feature_evidence.map((ev: any) => (
                    <div key={ev.feature}
                      className={`p-3 rounded-lg border text-xs ${ev.flagged ? 'border-[#ff444330] bg-[#ff444408]' : 'border-[#0d1b2e] bg-[#060b14]'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">{ev.feature}</span>
                        {ev.flagged && <Badge variant="anomaly">Flagged</Badge>}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[#64748b]">
                        <div>Value: <span className="text-white font-mono">{ev.value?.toFixed?.(4) ?? ev.value ?? '—'}</span></div>
                        <div>Z-Score: <span className={`font-mono font-bold ${ev.z_violated ? 'text-[#ff4444]' : 'text-[#94a3b8]'}`}>{ev.z_score != null ? (ev.z_score > 0 ? '+' : '') + ev.z_score?.toFixed(2) : '—'}</span></div>
                        <div>Baseline μ: <span className="text-[#94a3b8] font-mono">{ev.baseline_mean?.toFixed?.(2) ?? '—'}</span></div>
                        <div>Baseline σ: <span className="text-[#94a3b8] font-mono">{ev.baseline_std?.toFixed?.(2) ?? '—'}</span></div>
                        <div>IQR Lower: <span className="text-[#94a3b8] font-mono">{ev.iqr_lower?.toFixed?.(2) ?? '—'}</span></div>
                        <div>IQR Upper: <span className="text-[#94a3b8] font-mono">{ev.iqr_upper?.toFixed?.(2) ?? '—'}</span></div>
                        <div>IQR Fence: <span className={ev.iqr_violated ? 'text-[#ff4444]' : 'text-[#00ff88]'}>{ev.iqr_violated ? '⚠ Violated' : '✓ Within'}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Disclaimer */}
              <div className="p-3 bg-[#0d1b2e] rounded-lg border border-[#1e3a5f]">
                <p className="text-xs text-[#475569] leading-relaxed">
                  ⚠️ <strong className="text-[#64748b]">Defensive Notice:</strong> This record is flagged based on statistical rarity.
                  It does not confirm malicious activity. Benign events such as large file transfers, database backups, or video conferencing
                  can produce high anomaly scores. Correlate with endpoint and firewall logs before taking action.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
