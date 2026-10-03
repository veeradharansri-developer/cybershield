import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import apiClient from '../api';
import { useSession } from '../context/SessionContext';
import { PageHeader, Section, Alert, Spinner } from '../components/UI';

export default function HypothesisPage() {
  const { session } = useSession();
  const [feature, setFeature] = useState('');
  const [groupCol, setGroupCol] = useState('');
  const [groups, setGroups] = useState<string[]>([]);
  const [group1, setGroup1] = useState('');
  const [group2, setGroup2] = useState('');
  const [test, setTest] = useState('auto');
  const [alpha, setAlpha] = useState(0.05);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (session.numericCols.length > 0) setFeature(session.numericCols[0]);
    if (session.categoricalCols.length > 0) setGroupCol(session.categoricalCols[0]);
  }, [session.numericCols, session.categoricalCols]);

  useEffect(() => {
    if (!groupCol || !session.sessionId) return;
    apiClient.getFeatureStats(session.sessionId, groupCol)
      .then(r => {
        if (r.data.type === 'categorical') {
          const vals = r.data.frequency.map((f: any) => f.value);
          setGroups(vals);
          setGroup1(vals[0] || '');
          setGroup2(vals[1] || '');
        }
      });
  }, [groupCol]);

  const runTest = async () => {
    if (!feature || !groupCol || !group1 || !group2 || group1 === group2) {
      setError('Please select different groups for comparison.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const r = await apiClient.runHypothesisTest(session.sessionId!, { feature, group_col: groupCol, group1, group2, test, alpha });
      setResult(r.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Test failed. Check your selections.');
    } finally {
      setLoading(false);
    }
  };

  if (!session.sessionId) return <div className="max-w-4xl mx-auto px-4 py-8"><Alert type="warning">No dataset loaded.</Alert></div>;

  const comparisonData = result ? [
    { name: result.group1.name, Mean: +result.group1.mean.toFixed(2), Median: +result.group1.median.toFixed(2) },
    { name: result.group2.name, Mean: +result.group2.mean.toFixed(2), Median: +result.group2.median.toFixed(2) },
  ] : [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader title="Statistical Hypothesis Testing" subtitle="Test whether network feature distributions differ between traffic cohorts." badge="Inferential Statistics" />

      <Alert type="info">
        Tests are selected based on data characteristics. Mann-Whitney U is preferred for non-normal network distributions.
        Reject H₀ means a statistically significant difference was found at the chosen significance level.
      </Alert>

      {/* Config */}
      <Section title="Test Configuration" className="mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-[#64748b] mb-1 block">Continuous Feature Under Test</label>
            <select value={feature} onChange={e => setFeature(e.target.value)}
              className="w-full bg-[#0d1b2e] border border-[#1e3a5f] text-white text-sm rounded px-3 py-2 outline-none focus:border-[#00d4ff]">
              {session.numericCols.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-[#64748b] mb-1 block">Group / Label Column</label>
            <select value={groupCol} onChange={e => setGroupCol(e.target.value)}
              className="w-full bg-[#0d1b2e] border border-[#1e3a5f] text-white text-sm rounded px-3 py-2 outline-none focus:border-[#00d4ff]">
              {session.categoricalCols.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-[#64748b] mb-1 block">Group 1 (Baseline)</label>
            <select value={group1} onChange={e => setGroup1(e.target.value)}
              className="w-full bg-[#0d1b2e] border border-[#1e3a5f] text-white text-sm rounded px-3 py-2 outline-none focus:border-[#00d4ff]">
              {groups.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-[#64748b] mb-1 block">Group 2 (Comparison)</label>
            <select value={group2} onChange={e => setGroup2(e.target.value)}
              className="w-full bg-[#0d1b2e] border border-[#1e3a5f] text-white text-sm rounded px-3 py-2 outline-none focus:border-[#00d4ff]">
              {groups.filter(g => g !== group1).map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-[#64748b] mb-1 block">Statistical Test</label>
            <select value={test} onChange={e => setTest(e.target.value)}
              className="w-full bg-[#0d1b2e] border border-[#1e3a5f] text-white text-sm rounded px-3 py-2 outline-none focus:border-[#00d4ff]">
              <option value="auto">Auto-select (recommended)</option>
              <option value="ttest">Welch's t-Test</option>
              <option value="mannwhitney">Mann-Whitney U</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-[#64748b] mb-1 block">Significance Level (α)</label>
            <select value={alpha} onChange={e => setAlpha(+e.target.value)}
              className="w-full bg-[#0d1b2e] border border-[#1e3a5f] text-white text-sm rounded px-3 py-2 outline-none focus:border-[#00d4ff]">
              <option value={0.05}>0.05 (5%)</option>
              <option value={0.01}>0.01 (1%)</option>
              <option value={0.001}>0.001 (0.1%)</option>
            </select>
          </div>
        </div>

        {error && <Alert type="error">{error}</Alert>}

        <button onClick={runTest} disabled={loading}
          className="mt-2 px-6 py-2.5 bg-[#00d4ff] text-[#060b14] font-bold rounded-lg hover:bg-[#00b8d9] disabled:opacity-50 text-sm transition-all">
          {loading ? 'Running test…' : 'Execute Hypothesis Test'}
        </button>
      </Section>

      {loading && <Spinner />}

      {result && !loading && (
        <div className="space-y-6 mt-6 fade-in">
          {/* Hypotheses */}
          <Section title="Hypothesis Formulation">
            <div className="space-y-3">
              <div className="bg-[#0d1b2e] rounded-lg p-4">
                <span className="text-xs text-[#64748b] font-mono">H₀ (Null Hypothesis)</span>
                <p className="text-white text-sm mt-1">{result.h0}</p>
              </div>
              <div className="bg-[#0d1b2e] rounded-lg p-4">
                <span className="text-xs text-[#64748b] font-mono">H₁ (Alternative Hypothesis)</span>
                <p className="text-white text-sm mt-1">{result.h1}</p>
              </div>
            </div>
          </Section>

          {/* Results */}
          <Section title={`Results — ${result.test_name}`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-[#0d1b2e] rounded-lg p-3 text-center">
                <div className="text-xs text-[#64748b] mb-1">{result.stat_label}</div>
                <div className="text-[#00d4ff] font-mono font-bold">{result.test_statistic.toFixed(4)}</div>
              </div>
              <div className="bg-[#0d1b2e] rounded-lg p-3 text-center">
                <div className="text-xs text-[#64748b] mb-1">p-value</div>
                <div className={`font-mono font-bold ${result.reject_null ? 'text-[#ff4444]' : 'text-[#00ff88]'}`}>
                  {result.p_value < 0.0001 ? result.p_value.toExponential(2) : result.p_value.toFixed(6)}
                </div>
              </div>
              <div className="bg-[#0d1b2e] rounded-lg p-3 text-center">
                <div className="text-xs text-[#64748b] mb-1">Significance (α)</div>
                <div className="text-white font-mono font-bold">{result.alpha}</div>
              </div>
              <div className="bg-[#0d1b2e] rounded-lg p-3 text-center">
                <div className="text-xs text-[#64748b] mb-1">{result.effect_label}</div>
                <div className="text-[#f59e0b] font-mono font-bold">{result.effect_size.toFixed(3)}</div>
              </div>
            </div>

            <div className={`border rounded-lg p-4 mb-4 ${result.reject_null ? 'border-[#ff444430] bg-[#ff444408]' : 'border-[#00ff8830] bg-[#00ff8808]'}`}>
              <div className={`text-lg font-bold mb-1 ${result.reject_null ? 'text-[#ff4444]' : 'text-[#00ff88]'}`}>
                {result.reject_null ? '⚠️' : '✓'} Decision: {result.decision}
              </div>
              <p className="text-sm text-[#94a3b8]">{result.interpretation}</p>
            </div>

            {/* Group comparison */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {[result.group1, result.group2].map(g => (
                <div key={g.name} className="bg-[#0d1b2e] rounded-lg p-3">
                  <div className="text-xs text-[#00d4ff] font-semibold mb-2">{g.name} (n={g.n})</div>
                  <div className="text-xs space-y-1 text-[#94a3b8]">
                    <div>Mean: <span className="text-white">{g.mean.toFixed(4)}</span></div>
                    <div>Median: <span className="text-white">{g.median.toFixed(4)}</span></div>
                    <div>Std: <span className="text-white">{g.std.toFixed(4)}</span></div>
                  </div>
                </div>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={comparisonData}>
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 8 }} />
                <Bar dataKey="Mean" fill="#00d4ff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Median" fill="#00ff88" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-3 text-xs text-[#64748b]">
              Normality assumption met: <span className={result.normality_met ? 'text-[#00ff88]' : 'text-[#f59e0b]'}>{result.normality_met ? 'Yes' : 'No — non-parametric test recommended'}</span>
              {' | '} Equal variances: <span className={result.equal_variance ? 'text-[#00ff88]' : 'text-[#f59e0b]'}>{result.equal_variance ? 'Yes' : 'No (Welch correction applied)'}</span>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
