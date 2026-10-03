import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import apiClient from '../api';
import { useSession } from '../context/SessionContext';
import { PageHeader, Section, Alert, Spinner, StatCard } from '../components/UI';
import { ChevronRight, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const COLORS = ['#00d4ff', '#ff4444'];

export default function AnomalyPage() {
  const { session, setSession } = useSession();
  const navigate = useNavigate();
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [method, setMethod] = useState<'both' | 'zscore' | 'iqr'>('both');
  const [zThresh, setZThresh] = useState(3.0);
  const [iqrMult, setIqrMult] = useState(1.5);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const numericCols = session.numericCols;

  const toggleFeature = (feat: string) => {
    setSelectedFeatures(prev =>
      prev.includes(feat) ? prev.filter(f => f !== feat) : [...prev, feat]
    );
  };

  const selectAll = () => setSelectedFeatures([...numericCols]);
  const clearAll = () => setSelectedFeatures([]);

  const runDetection = async () => {
    if (!session.sessionId || selectedFeatures.length === 0) return;
    setLoading(true);
    try {
      const r = await apiClient.detectAnomalies(session.sessionId, {
        features: selectedFeatures,
        method,
        z_thresh: zThresh,
        iqr_mult: iqrMult,
      });
      setResults(r.data);
      setSession(s => ({
        ...s,
        anomalyResults: {
          total: r.data.total,
          normal: r.data.normal,
          anomalous: r.data.anomalous,
          anomaly_pct: r.data.anomaly_pct,
          features_used: r.data.features_used,
        }
      }));
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Detection failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!session.sessionId) return <div className="max-w-5xl mx-auto px-4 py-8"><Alert type="warning">No dataset loaded.</Alert></div>;

  const pieData = results ? [
    { name: 'Normal Traffic', value: results.normal },
    { name: 'Statistically Unusual', value: results.anomalous },
  ] : [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader title="Statistical Anomaly Detection Engine" subtitle="Detect unusual network flows using Z-Score and IQR statistical methods." badge="Core Engine" />

      <Alert type="warning">
        Anomalies represent <strong>statistical rarity</strong>, not confirmed attacks.
        Legitimate large file transfers or backups can produce high anomaly scores.
      </Alert>

      {/* Mathematical explanation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
        <div className="cyber-card p-4">
          <h3 className="text-sm font-semibold text-[#00d4ff] mb-2">Method 1: Z-Score</h3>
          <code className="text-[#00ff88] text-xs block mb-2">Z = (x − μ) / σ</code>
          <p className="text-xs text-[#64748b]">Flag records where |Z| exceeds threshold. Assumes roughly symmetric distribution.</p>
        </div>
        <div className="cyber-card p-4">
          <h3 className="text-sm font-semibold text-[#00d4ff] mb-2">Method 2: IQR Tukey's Fences</h3>
          <code className="text-[#00ff88] text-xs block mb-2">Bounds: [Q1 − k·IQR, Q3 + k·IQR]</code>
          <p className="text-xs text-[#64748b]">Non-parametric bounds. Robust to skewed network distributions (traffic rates, durations).</p>
        </div>
      </div>

      {/* Configuration */}
      <Section title="Detection Configuration" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs text-[#64748b] mb-1 block">Detection Method</label>
            <div className="flex gap-2">
              {(['both', 'zscore', 'iqr'] as const).map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-all border ${
                    method === m ? 'border-[#00d4ff] bg-[#00d4ff20] text-[#00d4ff]' : 'border-[#1e3a5f] text-[#64748b] hover:border-[#00d4ff40]'
                  }`}>
                  {m === 'both' ? 'Z + IQR' : m === 'zscore' ? 'Z-Score' : 'IQR Only'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[#64748b] mb-2 block">Z-Score Threshold: <span className="text-[#00d4ff]">{zThresh}σ</span></label>
            <input type="range" min={1.5} max={5} step={0.1} value={zThresh}
              onChange={e => setZThresh(+e.target.value)}
              className="w-full accent-[#00d4ff]" />
            <div className="flex justify-between text-xs text-[#475569] mt-1"><span>1.5σ (loose)</span><span>5.0σ (strict)</span></div>
          </div>
          <div>
            <label className="text-xs text-[#64748b] mb-2 block">IQR Multiplier: <span className="text-[#00d4ff]">{iqrMult}×</span></label>
            <input type="range" min={1} max={3} step={0.1} value={iqrMult}
              onChange={e => setIqrMult(+e.target.value)}
              className="w-full accent-[#00d4ff]" />
            <div className="flex justify-between text-xs text-[#475569] mt-1"><span>1.0 (tight)</span><span>3.0 (wide)</span></div>
          </div>
        </div>

        {/* Feature selector */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-[#64748b]">Select Features for Analysis ({selectedFeatures.length}/{numericCols.length})</label>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-[#00d4ff] hover:underline">All</button>
              <button onClick={clearAll} className="text-xs text-[#64748b] hover:underline">Clear</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 p-3 bg-[#0d1b2e] rounded-lg max-h-40 overflow-y-auto">
            {numericCols.map(col => (
              <button
                key={col}
                onClick={() => toggleFeature(col)}
                className={`px-2 py-1 rounded text-xs transition-all border ${
                  selectedFeatures.includes(col)
                    ? 'border-[#00d4ff] bg-[#00d4ff20] text-[#00d4ff]'
                    : 'border-[#1e3a5f] text-[#64748b] hover:border-[#00d4ff40]'
                }`}
              >
                {col}
              </button>
            ))}
          </div>
        </div>

        <button onClick={runDetection} disabled={loading || selectedFeatures.length === 0}
          className="px-6 py-2.5 bg-[#00d4ff] text-[#060b14] font-bold rounded-lg hover:bg-[#00b8d9] disabled:opacity-50 text-sm transition-all flex items-center gap-2">
          <Shield className="w-4 h-4" />
          {loading ? 'Analyzing…' : 'Run Anomaly Detection'}
        </button>
      </Section>

      {loading && <Spinner />}

      {results && !loading && (
        <div className="space-y-6 fade-in">
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Evaluated" value={results.total.toLocaleString()} color="cyan" />
            <StatCard label="Normal Traffic" value={results.normal.toLocaleString()} color="green" />
            <StatCard label="Statistically Unusual" value={results.anomalous.toLocaleString()} color="red" />
            <StatCard label="Anomaly Rate" value={`${results.anomaly_pct}%`} color="amber" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pie chart */}
            <Section title="Traffic Classification Breakdown">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </Section>

            {/* Feature violations */}
            <Section title="Violations Per Feature">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={results.feature_violations} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis type="category" dataKey="feature" tick={{ fill: '#94a3b8', fontSize: 10 }} width={120} />
                  <Tooltip contentStyle={{ background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 8 }} />
                  <Bar dataKey="violations" fill="#ff4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          </div>

          {/* Score distribution */}
          <Section title="Statistical Anomaly Score Distribution [0–100]">
            <p className="text-xs text-[#64748b] mb-3">
              Higher scores indicate greater multi-feature statistical deviation. This is a <strong>Statistical Anomaly Score</strong>, not an attack probability.
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={results.score_distribution}>
                <XAxis dataKey="bin" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 8 }} />
                <Bar dataKey="count" fill="#f59e0b" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>

          <button onClick={() => navigate('/investigate')}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#00d4ff] text-[#060b14] font-bold rounded-lg hover:bg-[#00b8d9] transition-all text-sm">
            Investigate Flagged Records
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
