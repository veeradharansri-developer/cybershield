import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api';
import { useSession } from '../context/SessionContext';
import { PageHeader, Alert, Spinner } from '../components/UI';

export default function UploadPage() {
  const navigate = useNavigate();
  const { session, setSession } = useSession();
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiClient.uploadFile(file);
      const d = res.data;
      setSession({
        sessionId: d.session_id,
        filename: d.filename,
        rows: d.rows,
        cols: d.cols,
        columns: d.columns,
        numericCols: d.quality.numeric_cols,
        categoricalCols: d.quality.categorical_cols,
        mapping: d.mapping,
        isCleaned: false,
        anomalyResults: null,
      });
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Upload failed. Ensure file is valid CSV/Excel and backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader
        title="Dataset Upload"
        subtitle="Upload your network traffic CSV or Excel file for analysis."
        badge="Step 1"
      />

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all mb-6 cursor-pointer ${
          dragging ? 'border-[#00d4ff] bg-[#00d4ff08]' : 'border-[#1e3a5f] hover:border-[#00d4ff40] hover:bg-[#111d30]'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
        />
        {loading ? (
          <Spinner />
        ) : (
          <>
            <Upload className="w-12 h-12 text-[#1e3a5f] mx-auto mb-4" />
            <p className="text-white font-semibold mb-1">Drop your file here</p>
            <p className="text-[#64748b] text-sm mb-4">or click to browse</p>
            <p className="text-xs text-[#334155]">Supports CSV and Excel (.xlsx) — Max 50,000 rows sampled</p>
          </>
        )}
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {/* Session info after upload */}
      {session.sessionId && !loading && (
        <div className="cyber-card p-6 fade-in">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-[#00ff88]" />
            <h2 className="text-white font-semibold">Dataset Loaded Successfully</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Filename', value: session.filename || '—' },
              { label: 'Total Rows', value: session.rows.toLocaleString() },
              { label: 'Total Columns', value: session.cols },
              { label: 'Numeric Features', value: session.numericCols.length },
            ].map(stat => (
              <div key={stat.label} className="bg-[#0d1b2e] rounded-lg p-3">
                <div className="text-xs text-[#64748b] mb-1">{stat.label}</div>
                <div className="text-white font-semibold text-sm truncate">{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Mapping table */}
          <div className="mb-6">
            <h3 className="text-xs text-[#64748b] uppercase tracking-wider mb-3">Detected Column Mapping</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1e3a5f]">
                    <th className="text-left py-2 text-[#64748b] font-medium">Standard Feature</th>
                    <th className="text-left py-2 text-[#64748b] font-medium">Mapped Column</th>
                    <th className="text-left py-2 text-[#64748b] font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(session.mapping).map(([canonical, mapped]) => (
                    <tr key={canonical} className="border-b border-[#0d1b2e]">
                      <td className="py-1.5 text-[#94a3b8] font-mono">{canonical}</td>
                      <td className="py-1.5 text-white">{mapped || '—'}</td>
                      <td className="py-1.5">
                        {mapped ? (
                          <span className="text-[#00ff88]">✓ Mapped</span>
                        ) : (
                          <span className="text-[#475569]">Optional</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Column list */}
          <div className="mb-6">
            <h3 className="text-xs text-[#64748b] uppercase tracking-wider mb-2">All Columns ({session.columns.length})</h3>
            <div className="flex flex-wrap gap-1.5">
              {session.columns.map(col => (
                <span
                  key={col}
                  className={`text-xs px-2 py-0.5 rounded-md ${
                    session.numericCols.includes(col)
                      ? 'bg-[#00d4ff10] text-[#00d4ff] border border-[#00d4ff20]'
                      : 'bg-[#111d30] text-[#64748b] border border-[#1e3a5f]'
                  }`}
                >
                  {col}
                </span>
              ))}
            </div>
          </div>

          <Alert type="info">
            <strong>Next Step:</strong> Proceed to Data Cleaning to handle missing values, duplicates, and infinities.
          </Alert>

          <button
            onClick={() => navigate('/clean')}
            className="mt-4 flex items-center gap-2 px-6 py-2.5 bg-[#00d4ff] text-[#060b14] font-bold rounded-lg hover:bg-[#00b8d9] transition-all text-sm"
          >
            Continue to Data Cleaning
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Supported formats */}
      {!session.sessionId && !loading && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: 'CICIDS-2017', desc: 'Canadian Institute Cybersecurity Intrusion Detection dataset' },
            { name: 'UNSW-NB15', desc: 'University of NSW network behavior analysis dataset' },
            { name: 'NSL-KDD', desc: 'Network Security Lab KDD Cup dataset variant' },
          ].map(ds => (
            <div key={ds.name} className="cyber-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-[#64748b]" />
                <span className="text-white text-xs font-semibold">{ds.name}</span>
              </div>
              <p className="text-xs text-[#475569]">{ds.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
