import { useState, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import apiClient from '../api';
import { useSession } from '../context/SessionContext';
import { PageHeader, Section, Alert, Spinner } from '../components/UI';

function CorrelationCell({ r }: { r: number }) {
  const abs = Math.abs(r);
  const alpha = abs * 0.9;
  const bg = r > 0
    ? `rgba(0, 212, 255, ${alpha})`
    : `rgba(255, 68, 68, ${alpha})`;
  const text = abs > 0.5 ? '#fff' : '#94a3b8';
  return (
    <div
      className="w-full h-full flex items-center justify-center text-xs font-mono rounded"
      style={{ background: bg, color: text }}
    >
      {r.toFixed(2)}
    </div>
  );
}

export default function CorrelationPage() {
  const { session } = useSession();
  const [corrData, setCorrData] = useState<any>(null);
  const [scatterData, setScatterData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selX, setSelX] = useState('');
  const [selY, setSelY] = useState('');
  const [scatterLoading, setScatterLoading] = useState(false);

  useEffect(() => {
    if (!session.sessionId) return;
    apiClient.getCorrelation(session.sessionId)
      .then(r => {
        setCorrData(r.data);
        if (r.data.features.length >= 2) {
          setSelX(r.data.features[0]);
          setSelY(r.data.features[1]);
        }
      })
      .finally(() => setLoading(false));
  }, [session.sessionId]);

  useEffect(() => {
    if (!selX || !selY || selX === selY || !session.sessionId) return;
    setScatterLoading(true);
    apiClient.getScatter(session.sessionId, selX, selY)
      .then(r => setScatterData(r.data))
      .finally(() => setScatterLoading(false));
  }, [selX, selY]);

  if (!session.sessionId) return <div className="max-w-5xl mx-auto px-4 py-8"><Alert type="warning">No dataset loaded.</Alert></div>;

  const features = corrData?.features ?? [];
  const heatmap = corrData?.heatmap ?? [];
  const topPairs = corrData?.top_pairs ?? [];

  // Build matrix
  const matrix: Record<string, Record<string, number>> = {};
  heatmap.forEach((cell: any) => {
    if (!matrix[cell.y]) matrix[cell.y] = {};
    matrix[cell.y][cell.x] = cell.r;
  });

  const interpretStrength = (r: number) => {
    const a = Math.abs(r);
    const dir = r > 0 ? 'positive' : 'negative';
    if (a >= 0.8) return `Very strong ${dir}`;
    if (a >= 0.6) return `Strong ${dir}`;
    if (a >= 0.4) return `Moderate ${dir}`;
    if (a >= 0.2) return `Weak ${dir}`;
    return 'Negligible';
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader title="Correlation Analysis" subtitle="Pearson linear associations between numerical network features." badge="Statistics" />

      <Alert type="info">
        Correlation measures co-variation between features. High correlation does not imply causation or cyberattack.
      </Alert>

      {loading ? <Spinner /> : (
        <div className="space-y-6 mt-6 fade-in">
          {/* Heatmap */}
          <Section title="Pearson Correlation Matrix">
            <div className="overflow-x-auto">
              <div className="min-w-max">
                <div className="flex">
                  <div className="w-32" />
                  {features.map((f: string) => (
                    <div key={f} className="w-20 text-xs text-[#64748b] text-center p-1 truncate" title={f}>
                      {f.split(' ').slice(-1)[0]}
                    </div>
                  ))}
                </div>
                {features.map((rowF: string) => (
                  <div key={rowF} className="flex items-center">
                    <div className="w-32 text-xs text-[#64748b] pr-2 truncate" title={rowF}>{rowF}</div>
                    {features.map((colF: string) => (
                      <div key={colF} className="w-20 h-8 p-0.5">
                        <CorrelationCell r={matrix[rowF]?.[colF] ?? 0} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-[#64748b]">
              <div className="flex items-center gap-1"><div className="w-4 h-3 rounded bg-[#00d4ff]" /> Strong Positive</div>
              <div className="flex items-center gap-1"><div className="w-4 h-3 rounded" style={{ background: '#1e3a5f' }} /> Near Zero</div>
              <div className="flex items-center gap-1"><div className="w-4 h-3 rounded bg-[#ff4444]" /> Strong Negative</div>
            </div>
          </Section>

          {/* Top pairs */}
          <Section title="Top Correlated Feature Pairs">
            <div className="space-y-2">
              {topPairs.slice(0, 10).map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-3 border-b border-[#0d1b2e] pb-2">
                  <div className="flex-1 text-xs text-white">
                    <span className="text-[#00d4ff]">{p.a}</span>
                    <span className="text-[#475569] mx-2">↔</span>
                    <span className="text-[#00ff88]">{p.b}</span>
                  </div>
                  <div className="w-16 text-center">
                    <span className={`text-xs font-mono font-bold ${p.r > 0 ? 'text-[#00d4ff]' : 'text-[#ff4444]'}`}>
                      {p.r > 0 ? '+' : ''}{p.r}
                    </span>
                  </div>
                  <div className="w-32 text-xs text-[#64748b]">{interpretStrength(p.r)}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Scatter plot */}
          <Section title="Bivariate Scatter Plot">
            <div className="flex gap-4 mb-4">
              <div>
                <label className="text-xs text-[#64748b] mb-1 block">X-Axis</label>
                <select value={selX} onChange={e => setSelX(e.target.value)}
                  className="bg-[#0d1b2e] border border-[#1e3a5f] text-white text-sm rounded px-3 py-1.5 outline-none focus:border-[#00d4ff]">
                  {features.map((f: string) => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#64748b] mb-1 block">Y-Axis</label>
                <select value={selY} onChange={e => setSelY(e.target.value)}
                  className="bg-[#0d1b2e] border border-[#1e3a5f] text-white text-sm rounded px-3 py-1.5 outline-none focus:border-[#00d4ff]">
                  {features.map((f: string) => <option key={f}>{f}</option>)}
                </select>
              </div>
              {scatterData && (
                <div className="flex items-end">
                  <div className="bg-[#0d1b2e] rounded p-2 text-xs">
                    <span className="text-[#64748b]">Pearson r: </span>
                    <span className={`font-mono font-bold ${scatterData.r > 0 ? 'text-[#00d4ff]' : 'text-[#ff4444]'}`}>
                      {scatterData.r > 0 ? '+' : ''}{scatterData.r}
                    </span>
                    <span className="text-[#64748b] ml-3">p: </span>
                    <span className="text-white font-mono">{scatterData.p}</span>
                  </div>
                </div>
              )}
            </div>

            {scatterLoading && <Spinner />}

            {scatterData && !scatterLoading && (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart>
                    <XAxis dataKey="x" name={selX} tick={{ fill: '#64748b', fontSize: 11 }} label={{ value: selX, position: 'bottom', fill: '#475569', fontSize: 11 }} />
                    <YAxis dataKey="y" name={selY} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 8, fontSize: 12 }}
                      cursor={{ fill: '#00d4ff10' }}
                    />
                    <Scatter data={scatterData.points} fill="#00d4ff" opacity={0.7} />
                  </ScatterChart>
                </ResponsiveContainer>
                <p className="text-xs text-[#64748b] mt-2">
                  {interpretStrength(scatterData.r)} correlation (r = {scatterData.r}).{' '}
                  {scatterData.p < 0.05 ? 'Statistically significant (p < 0.05).' : 'Not statistically significant (p ≥ 0.05).'}
                  {' '}Note: Correlation indicates co-variation, not causation.
                </p>
              </>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
