import { useState, useEffect } from 'react';
import apiClient from '../api';
import { useSession } from '../context/SessionContext';
import { PageHeader, Section, Alert, Spinner } from '../components/UI';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function ProfilePage() {
  const { session } = useSession();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session.sessionId) return;
    apiClient.getNetworkProfile(session.sessionId)
      .then(r => setProfile(r.data))
      .finally(() => setLoading(false));
  }, [session.sessionId]);

  if (!session.sessionId) return <div className="max-w-5xl mx-auto px-4 py-8"><Alert type="warning">No dataset loaded.</Alert></div>;

  const COLORS = ['#00d4ff', '#00ff88', '#f59e0b', '#ff4444', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader title="Network Traffic Profile" subtitle="High-level characterization of the uploaded network dataset." badge="Profile" />

      {loading ? <Spinner /> : !profile ? <Alert type="error">Profile unavailable.</Alert> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 fade-in">
          {profile.protocols && (
            <Section title="Protocol Distribution">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={profile.protocols} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                    {profile.protocols.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </Section>
          )}

          {profile.top_ports && (
            <Section title="Top Destination Ports">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={profile.top_ports}>
                  <XAxis dataKey="port" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#00ff88" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          )}

          {profile.label_distribution && (
            <Section title="Label / Attack Category Distribution">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={profile.label_distribution} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} width={100} />
                  <Tooltip contentStyle={{ background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 8 }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {profile.label_distribution.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
          )}

          <Section title="Network Statistics">
            <div className="space-y-3">
              {profile.avg_duration !== null && profile.avg_duration !== undefined && (
                <div className="flex justify-between border-b border-[#0d1b2e] pb-2">
                  <span className="text-xs text-[#64748b]">Average Flow Duration</span>
                  <span className="text-white text-xs font-mono">{Number(profile.avg_duration).toFixed(2)} μs</span>
                </div>
              )}
              {profile.avg_pkt_size !== null && profile.avg_pkt_size !== undefined && (
                <div className="flex justify-between border-b border-[#0d1b2e] pb-2">
                  <span className="text-xs text-[#64748b]">Average Packet Size</span>
                  <span className="text-white text-xs font-mono">{Number(profile.avg_pkt_size).toFixed(2)} bytes</span>
                </div>
              )}
              {profile.anomaly_summary && (
                <div className="mt-4 p-3 bg-[#0d1b2e] rounded-lg">
                  <div className="text-xs text-[#64748b] mb-2">Anomaly Detection Summary</div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <div className="text-[#64748b]">Total</div>
                      <div className="text-white font-bold">{profile.anomaly_summary.total.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[#64748b]">Unusual</div>
                      <div className="text-[#ff4444] font-bold">{profile.anomaly_summary.anomalous.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[#64748b]">Rate</div>
                      <div className="text-[#f59e0b] font-bold">{profile.anomaly_summary.pct}%</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
