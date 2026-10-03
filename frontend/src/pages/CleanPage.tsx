import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import apiClient from '../api';
import { useSession } from '../context/SessionContext';
import { PageHeader, Section, Alert } from '../components/UI';

interface QR {
  total_rows: number;
  total_cols: number;
  missing: number;
  missing_by_col: Record<string, number>;
  duplicates: number;
  infinite_values: number;
  numeric_cols: string[];
  categorical_cols: string[];
}

export default function CleanPage() {
  const { session, setSession } = useSession();
  const navigate = useNavigate();
  const [before, setBefore] = useState<QR | null>(null);
  const [after, setAfter] = useState<QR | null>(null);
  const [changes, setChanges] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [opts, setOpts] = useState({
    remove_duplicates: true,
    handle_missing: 'median' as 'median' | 'mean' | 'drop',
    handle_infinities: true,
    clip_negatives: true,
  });

  useEffect(() => {
    if (session.sessionId) {
      apiClient.getQuality(session.sessionId).then(r => setBefore(r.data.before));
    }
  }, [session.sessionId]);

  const handleClean = async () => {
    if (!session.sessionId) return;
    setLoading(true);
    try {
      const r = await apiClient.cleanData(session.sessionId, opts);
      setAfter(r.data.after);
      setChanges(r.data.changes);
      setSession(s => ({ ...s, isCleaned: true, numericCols: r.data.after.numeric_cols, categoricalCols: r.data.after.categorical_cols }));
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Cleaning failed');
    } finally {
      setLoading(false);
    }
  };

  const qrRow = (label: string, b: number | string, a: number | string, highlight?: boolean) => (
    <tr key={label} className={`border-b border-[#0d1b2e] ${highlight ? 'bg-[#00ff8805]' : ''}`}>
      <td className="py-2 text-[#64748b] text-xs">{label}</td>
      <td className="py-2 text-white text-xs text-right">{b?.toLocaleString?.() ?? b}</td>
      <td className="py-2 text-xs text-right">
        {a !== undefined && a !== null ? (
          <span className="text-[#00ff88]">{a?.toLocaleString?.() ?? a}</span>
        ) : '—'}
      </td>
    </tr>
  );

  if (!session.sessionId) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Alert type="warning">No dataset loaded. Please upload a file first.</Alert>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader title="Data Cleaning" subtitle="Inspect data quality and apply cleaning transformations." badge="Step 2" />

      {/* Quality comparison */}
      {before && (
        <Section title="Data Quality Report" className="mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e3a5f]">
                <th className="text-left py-2 text-[#64748b] text-xs">Metric</th>
                <th className="text-right py-2 text-[#64748b] text-xs">Before Cleaning</th>
                <th className="text-right py-2 text-[#64748b] text-xs">After Cleaning</th>
              </tr>
            </thead>
            <tbody>
              {qrRow('Total Rows', before.total_rows, after?.total_rows ?? '—')}
              {qrRow('Total Columns', before.total_cols, after?.total_cols ?? '—')}
              {qrRow('Missing Values', before.missing, after?.missing ?? '—', before.missing > 0)}
              {qrRow('Duplicate Rows', before.duplicates, after?.duplicates ?? '—', before.duplicates > 0)}
              {qrRow('Infinite Values', before.infinite_values, after?.infinite_values ?? '—', before.infinite_values > 0)}
              {qrRow('Numeric Features', before.numeric_cols.length, after?.numeric_cols.length ?? '—')}
            </tbody>
          </table>

          {Object.keys(before.missing_by_col).length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-[#64748b] mb-2">Columns with missing values:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(before.missing_by_col).map(([col, count]) => (
                  <span key={col} className="badge-info text-xs px-2 py-0.5 rounded">
                    {col}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Cleaning options */}
      <Section title="Cleaning Configuration" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={opts.remove_duplicates}
              onChange={e => setOpts(o => ({ ...o, remove_duplicates: e.target.checked }))}
              className="w-4 h-4 accent-[#00d4ff]"
            />
            <div>
              <div className="text-white text-sm font-medium">Remove Duplicate Rows</div>
              <div className="text-[#64748b] text-xs">Deduplicate identical network flow records</div>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={opts.handle_infinities}
              onChange={e => setOpts(o => ({ ...o, handle_infinities: e.target.checked }))}
              className="w-4 h-4 accent-[#00d4ff]"
            />
            <div>
              <div className="text-white text-sm font-medium">Replace Infinite Values</div>
              <div className="text-[#64748b] text-xs">Replace ±∞ with NaN then impute</div>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={opts.clip_negatives}
              onChange={e => setOpts(o => ({ ...o, clip_negatives: e.target.checked }))}
              className="w-4 h-4 accent-[#00d4ff]"
            />
            <div>
              <div className="text-white text-sm font-medium">Clip Negative Metrics</div>
              <div className="text-[#64748b] text-xs">Clip negative packet/byte counts to 0</div>
            </div>
          </label>

          <div>
            <div className="text-white text-sm font-medium mb-2">Handle Missing Values</div>
            <div className="flex gap-2">
              {(['median', 'mean', 'drop'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setOpts(o => ({ ...o, handle_missing: m }))}
                  className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                    opts.handle_missing === m
                      ? 'bg-[#00d4ff20] border border-[#00d4ff] text-[#00d4ff]'
                      : 'bg-[#0d1b2e] border border-[#1e3a5f] text-[#64748b] hover:border-[#00d4ff40]'
                  }`}
                >
                  {m === 'median' ? 'Median Impute' : m === 'mean' ? 'Mean Impute' : 'Drop Rows'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleClean}
          disabled={loading}
          className="mt-6 flex items-center gap-2 px-6 py-2.5 bg-[#00d4ff] text-[#060b14] font-bold rounded-lg hover:bg-[#00b8d9] disabled:opacity-50 transition-all text-sm"
        >
          {loading ? 'Cleaning…' : 'Apply Cleaning'}
        </button>
      </Section>

      {/* Changelog */}
      {changes && (
        <Section title="Cleaning Audit Log" className="mb-6">
          <div className="space-y-2">
            {Object.entries(changes).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs border-b border-[#0d1b2e] py-1.5">
                <span className="text-[#64748b] font-mono">{k}</span>
                <span className="text-[#00ff88]">{String(v)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {after && (
        <>
          <Alert type="success">Data cleaning complete. Proceed to the Analysis Overview.</Alert>
          <button
            onClick={() => navigate('/overview')}
            className="mt-4 flex items-center gap-2 px-6 py-2.5 bg-[#00d4ff] text-[#060b14] font-bold rounded-lg hover:bg-[#00b8d9] transition-all text-sm"
          >
            Continue to Overview
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}
