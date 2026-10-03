import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api';
import { useSession } from '../context/SessionContext';
import { PageHeader, Alert, Spinner, Badge } from '../components/UI';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import InvestigateDrawer from '../components/InvestigateDrawer';

export default function InvestigatePage() {
  const { session } = useSession();
  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('all');
  const [minScore, setMinScore] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!session.sessionId) return;
    setLoading(true);
    try {
      const r = await apiClient.getAnomalyRecords(session.sessionId, {
        page, page_size: 50, status, min_score: minScore, search
      });
      setRecords(r.data.records);
      setTotal(r.data.total);
      setPages(r.data.pages);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [session.sessionId, page, status, minScore, search]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const clearSearch = () => { setSearch(''); setPage(1); };

  if (!session.sessionId) return <div className="max-w-6xl mx-auto px-4 py-8"><Alert type="warning">No dataset loaded.</Alert></div>;

  if (!session.anomalyResults) return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Alert type="warning">Run Anomaly Detection first to investigate records.</Alert>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <PageHeader title="Anomaly Investigation" subtitle="Search, filter, and investigate individual network flow records." badge="Analyst View" />

      {/* Filters */}
      <div className="cyber-card p-4 mb-4 flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#475569]" />
          <input
            type="text"
            placeholder="Search protocol, label…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 pr-8 py-2 bg-[#0d1b2e] border border-[#1e3a5f] text-white text-sm rounded-lg outline-none focus:border-[#00d4ff] w-52"
          />
          {search && <button onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-[#475569]" /></button>}
        </div>

        {/* Status filter */}
        <div className="flex gap-1">
          {(['all', 'anomalous', 'normal'] as const).map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                status === s ? 'border-[#00d4ff] bg-[#00d4ff20] text-[#00d4ff]' : 'border-[#1e3a5f] text-[#64748b] hover:border-[#00d4ff40]'
              }`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Min score */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#64748b] whitespace-nowrap">Min Score:</label>
          <input type="number" min={0} max={100} value={minScore} onChange={e => { setMinScore(+e.target.value); setPage(1); }}
            className="w-16 bg-[#0d1b2e] border border-[#1e3a5f] text-white text-sm rounded px-2 py-1 outline-none focus:border-[#00d4ff]" />
        </div>

        <span className="text-xs text-[#475569] ml-auto">{total.toLocaleString()} records</span>
      </div>

      {/* Table */}
      <div className="cyber-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1e3a5f] bg-[#0d1b2e]">
                {['ID', 'Protocol', 'Duration', 'Packets', 'Bytes', 'Score', 'Z Violations', 'Status', 'Label'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[#64748b] font-medium uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-8"><Spinner /></td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-[#475569]">No records found</td></tr>
              ) : (
                records.map(rec => (
                  <tr
                    key={rec.id}
                    className={`border-b border-[#0d1b2e] table-row-hover transition-all ${selectedId === rec.id ? 'bg-[#00d4ff08]' : ''}`}
                    onClick={() => setSelectedId(rec.id)}
                  >
                    <td className="px-4 py-2.5 font-mono text-[#64748b]">#{rec.id}</td>
                    <td className="px-4 py-2.5 text-white">{rec.protocol}</td>
                    <td className="px-4 py-2.5 text-[#94a3b8]">{rec.duration?.toLocaleString() ?? '—'}</td>
                    <td className="px-4 py-2.5 text-[#94a3b8]">{rec.packets?.toLocaleString() ?? '—'}</td>
                    <td className="px-4 py-2.5 text-[#94a3b8]">{rec.bytes?.toLocaleString() ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-[#0d1b2e] rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${rec.anomaly_score}%`,
                              background: rec.anomaly_score > 70 ? '#ff4444' : rec.anomaly_score > 40 ? '#f59e0b' : '#00ff88'
                            }}
                          />
                        </div>
                        <span className="text-white font-mono">{rec.anomaly_score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[#f59e0b]">{rec.z_violations}</td>
                    <td className="px-4 py-2.5">
                      {rec.is_anomaly ? <Badge variant="anomaly">Unusual</Badge> : <Badge variant="normal">Normal</Badge>}
                    </td>
                    <td className="px-4 py-2.5 text-[#64748b]">{rec.label || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e3a5f]">
          <span className="text-xs text-[#475569]">Page {page} of {pages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded border border-[#1e3a5f] text-[#64748b] hover:border-[#00d4ff40] disabled:opacity-30">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
              className="p-1.5 rounded border border-[#1e3a5f] text-[#64748b] hover:border-[#00d4ff40] disabled:opacity-30">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      {selectedId !== null && (
        <InvestigateDrawer
          sessionId={session.sessionId}
          recordId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
