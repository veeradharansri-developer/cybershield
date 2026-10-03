import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import apiClient from '../api';
import { useSession } from '../context/SessionContext';
import { PageHeader, StatCard, Alert, Spinner, Section } from '../components/UI';
import { ChevronRight, Database, Activity, AlertTriangle, CheckCircle } from 'lucide-react';

const COLORS = ['#00d4ff', '#00ff88', '#f59e0b', '#ff4444', '#a855f7', '#ec4899'];

export default function OverviewPage() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session.sessionId) return;
    apiClient.getNetworkProfile(session.sessionId)
      .then(r => setProfile(r.data))
      .finally(() => setLoading(false));
  }, [session.sessionId]);

  if (!session.sessionId) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Alert type="warning">No dataset loaded. Please upload a file first.</Alert>
      </div>
    );
  }

  const anom = session.anomalyResults;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader
        title="Analysis Overview"
        subtitle="Summary of the loaded network traffic dataset and current analysis state."
        badge="Dashboard"
      />

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Records" value={session.rows.toLocaleString()} icon={<Database className="w-4 h-4" />} color="cyan" />
        <StatCard label="Features Analyzed" value={session.numericCols.length} icon={<Activity className="w-4 h-4" />} />
        <StatCard
          label="Anomalous"
          value={anom ? `${anom.anomalous.toLocaleString()}` : '—'}
          sub={anom ? `${anom.anomaly_pct}% of total` : 'Run detection first'}
          color={anom ? 'red' : 'default'}
          icon={<AlertTriangle className="w-4 h-4" />}
        />
        <StatCard
          label="Normal"
          value={anom ? anom.normal.toLocaleString() : '—'}
          color={anom ? 'green' : 'default'}
          icon={<CheckCircle className="w-4 h-4" />}
        />
      </div>

      {loading ? <Spinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Protocol distribution */}
          {profile?.protocols && (
            <Section title="Protocol Distribution">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={profile.protocols}>
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#00d4ff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* Label distribution */}
          {profile?.label_distribution && (
            <Section title="Traffic Label Distribution">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={profile.label_distribution}
                    dataKey="count"
                    nameKey="label"
                    cx="50%" cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {profile.label_distribution.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* Top ports */}
          {profile?.top_ports && (
            <Section title="Top Destination Ports">
              <div className="space-y-2">
                {profile.top_ports.slice(0, 8).map((p: any) => (
                  <div key={p.port} className="flex items-center gap-3">
                    <span className="text-xs text-[#64748b] w-16 text-right font-mono">:{p.port}</span>
                    <div className="flex-1 bg-[#0d1b2e] rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-[#00d4ff] to-[#00ff88]"
                        style={{ width: `${(p.count / profile.top_ports[0].count) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-[#94a3b8] w-16">{p.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Quick stats */}
          <Section title="Network Characteristics">
            <div className="space-y-3">
              {profile?.avg_duration !== undefined && (
                <div className="flex justify-between text-sm border-b border-[#0d1b2e] pb-2">
                  <span className="text-[#64748b]">Average Flow Duration</span>
                  <span className="text-white font-mono">{Number(profile.avg_duration).toFixed(2)} μs</span>
                </div>
              )}
              {profile?.avg_pkt_size !== undefined && (
                <div className="flex justify-between text-sm border-b border-[#0d1b2e] pb-2">
                  <span className="text-[#64748b]">Average Packet Size</span>
                  <span className="text-white font-mono">{Number(profile.avg_pkt_size).toFixed(2)} bytes</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-b border-[#0d1b2e] pb-2">
                <span className="text-[#64748b]">Dataset</span>
                <span className="text-white">{session.filename}</span>
              </div>
              <div className="flex justify-between text-sm border-b border-[#0d1b2e] pb-2">
                <span className="text-[#64748b]">Cleaning Applied</span>
                <span className={session.isCleaned ? 'text-[#00ff88]' : 'text-[#f59e0b]'}>
                  {session.isCleaned ? 'Yes' : 'Not yet'}
                </span>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-6 flex flex-wrap gap-3">
        <button onClick={() => navigate('/eda')} className="btn-cyber px-4 py-2 rounded-lg text-sm flex items-center gap-2">
          Explore Data (EDA) <ChevronRight className="w-4 h-4" />
        </button>
        <button onClick={() => navigate('/anomaly')} className="btn-cyber px-4 py-2 rounded-lg text-sm flex items-center gap-2">
          Run Anomaly Detection <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
