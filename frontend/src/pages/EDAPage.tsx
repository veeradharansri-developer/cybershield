import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell
} from 'recharts';
import apiClient from '../api';
import { useSession } from '../context/SessionContext';
import { PageHeader, Section, Alert, Spinner } from '../components/UI';

function formatNum(n: number | null | undefined) {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(4);
}

export default function EDAPage() {
  const { session } = useSession();
  const [selectedFeature, setSelectedFeature] = useState<string>('');
  const [filterCol, setFilterCol] = useState<string>('');
  const [filterVal, setFilterVal] = useState<string>('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filterVals, setFilterVals] = useState<string[]>([]);

  const allCols = [...session.numericCols, ...session.categoricalCols];

  useEffect(() => {
    if (allCols.length > 0 && !selectedFeature) {
      setSelectedFeature(allCols[0]);
    }
  }, [allCols.length]);

  useEffect(() => {
    if (!selectedFeature || !session.sessionId) return;
    setLoading(true);
    setData(null);
    apiClient.getFeatureStats(session.sessionId, selectedFeature, filterCol || undefined, filterVal || undefined)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [selectedFeature, filterCol, filterVal, session.sessionId]);

  // When filterCol changes, get unique values
  useEffect(() => {
    if (!filterCol || !session.sessionId) return;
    apiClient.getFeatureStats(session.sessionId, filterCol)
      .then(r => {
        if (r.data.type === 'categorical') {
          setFilterVals(r.data.frequency.map((f: any) => f.value));
        }
      });
    setFilterVal('');
  }, [filterCol]);

  if (!session.sessionId) {
    return <div className="max-w-5xl mx-auto px-4 py-8"><Alert type="warning">No dataset loaded.</Alert></div>;
  }

  const stats = data?.stats;
  const histogram = data?.histogram ?? [];
  const freq = data?.frequency ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader title="Exploratory Data Analysis" subtitle="Investigate feature distributions, statistics, and patterns." badge="EDA" />

      {/* Controls */}
      <div className="cyber-card p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs text-[#64748b] mb-1">Select Feature</label>
          <select
            value={selectedFeature}
            onChange={e => setSelectedFeature(e.target.value)}
            className="bg-[#0d1b2e] border border-[#1e3a5f] text-white text-sm rounded-lg px-3 py-2 focus:border-[#00d4ff] outline-none min-w-48"
          >
            <optgroup label="Numeric">
              {session.numericCols.map(c => <option key={c} value={c}>{c}</option>)}
            </optgroup>
            <optgroup label="Categorical">
              {session.categoricalCols.map(c => <option key={c} value={c}>{c}</option>)}
            </optgroup>
          </select>
        </div>

        <div>
          <label className="block text-xs text-[#64748b] mb-1">Filter by Column</label>
          <select
            value={filterCol}
            onChange={e => { setFilterCol(e.target.value); setFilterVal(''); }}
            className="bg-[#0d1b2e] border border-[#1e3a5f] text-white text-sm rounded-lg px-3 py-2 focus:border-[#00d4ff] outline-none"
          >
            <option value="">No filter</option>
            {session.categoricalCols.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {filterCol && filterVals.length > 0 && (
          <div>
            <label className="block text-xs text-[#64748b] mb-1">Filter Value</label>
            <select
              value={filterVal}
              onChange={e => setFilterVal(e.target.value)}
              className="bg-[#0d1b2e] border border-[#1e3a5f] text-white text-sm rounded-lg px-3 py-2 focus:border-[#00d4ff] outline-none"
            >
              <option value="">All values</option>
              {filterVals.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        )}
      </div>

      {loading && <Spinner />}

      {data && !loading && (
        <div className="space-y-6 fade-in">
          {data.type === 'numeric' && stats && (
            <>
              {/* Descriptive stats grid */}
              <Section title="Descriptive Statistics">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Mean (μ)', value: formatNum(stats.mean) },
                    { label: 'Median (Q₂)', value: formatNum(stats.median) },
                    { label: 'Std Dev (σ)', value: formatNum(stats.std) },
                    { label: 'Min', value: formatNum(stats.min) },
                    { label: 'Max', value: formatNum(stats.max) },
                    { label: 'Q1 (25th%)', value: formatNum(stats.q1) },
                    { label: 'Q3 (75th%)', value: formatNum(stats.q3) },
                    { label: 'IQR', value: formatNum(stats.iqr) },
                    { label: 'Skewness', value: formatNum(stats.skewness) },
                    { label: 'Excess Kurtosis', value: formatNum(stats.kurtosis) },
                    { label: 'Sample Count', value: stats.count?.toLocaleString() },
                  ].map(s => (
                    <div key={s.label} className="bg-[#0d1b2e] rounded-lg p-3">
                      <div className="text-xs text-[#64748b] mb-1">{s.label}</div>
                      <div className="text-[#00d4ff] font-mono text-sm font-semibold">{s.value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-3 bg-[#0d1b2e] rounded-lg text-xs text-[#64748b]">
                  {stats.skewness > 1 ? '⚡ Highly right-skewed — heavy tail (common in network bursts).' :
                   stats.skewness < -1 ? '⚡ Highly left-skewed distribution.' :
                   Math.abs(stats.skewness) < 0.5 ? '✓ Approximately symmetric distribution.' :
                   '↗ Moderately skewed distribution.'}
                  {stats.kurtosis > 1 ? ' Leptokurtic (heavy-tailed, more extreme outliers expected).' :
                   stats.kurtosis < -1 ? ' Platykurtic (thin-tailed).' : ' Near-normal tail behavior.'}
                </div>
              </Section>

              {/* Histogram */}
              <Section title={`Distribution Histogram — ${selectedFeature}`}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={histogram} barCategoryGap="5%">
                    <XAxis dataKey="bin" tick={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 8, fontSize: 12 }}
                      formatter={(v: any) => [v, 'Count']}
                    />
                    <Bar dataKey="count" fill="#00d4ff" radius={[2, 2, 0, 0]} opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              </Section>

              {/* Box plot info */}
              {data.boxplot && (
                <Section title="Box Plot Summary (Tukey's Fences)">
                  <div className="relative h-16 my-4">
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-[#1e3a5f]" />
                    <div
                      className="absolute top-1/4 h-1/2 bg-[#00d4ff20] border border-[#00d4ff60] rounded"
                      style={{
                        left: `${((data.boxplot.q1 - data.boxplot.min) / (data.boxplot.max - data.boxplot.min || 1)) * 100}%`,
                        width: `${((data.boxplot.q3 - data.boxplot.q1) / (data.boxplot.max - data.boxplot.min || 1)) * 100}%`,
                      }}
                    />
                    <div
                      className="absolute top-0 h-full w-px bg-[#00ff88]"
                      style={{ left: `${((data.boxplot.median - data.boxplot.min) / (data.boxplot.max - data.boxplot.min || 1)) * 100}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs">
                    {[
                      { label: 'Whisker Low', val: formatNum(data.boxplot.min) },
                      { label: 'Q1', val: formatNum(data.boxplot.q1) },
                      { label: 'Median', val: formatNum(data.boxplot.median) },
                      { label: 'Q3', val: formatNum(data.boxplot.q3) },
                      { label: 'Whisker High', val: formatNum(data.boxplot.max) },
                      { label: 'Outliers', val: data.boxplot.outliers.length },
                    ].map(b => (
                      <div key={b.label} className="bg-[#0d1b2e] p-2 rounded">
                        <div className="text-[#64748b] mb-1">{b.label}</div>
                        <div className="text-white font-mono">{b.val}</div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}

          {data.type === 'categorical' && (
            <Section title={`Frequency Table — ${selectedFeature}`}>
              <div className="space-y-2 mb-4">
                {freq.map((f: any) => (
                  <div key={f.value} className="flex items-center gap-3">
                    <span className="text-xs text-[#94a3b8] w-32 truncate">{f.value}</span>
                    <div className="flex-1 bg-[#0d1b2e] rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-[#00d4ff] to-[#00ff88]"
                        style={{ width: `${(f.count / freq[0]?.count) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-[#64748b] w-20 text-right">{f.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={freq.slice(0, 15)}>
                  <XAxis dataKey="value" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 8 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {freq.slice(0, 15).map((_: any, i: number) => (
                      <Cell key={i} fill={i === 0 ? '#00d4ff' : i < 3 ? '#00ff88' : '#1e3a5f'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
