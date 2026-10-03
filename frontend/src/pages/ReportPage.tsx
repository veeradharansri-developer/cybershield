import { useState } from 'react';
import apiClient from '../api';
import { useSession } from '../context/SessionContext';
import { PageHeader, Alert, Spinner } from '../components/UI';
import { Download, FileText } from 'lucide-react';

export default function ReportPage() {
  const { session } = useSession();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const fetchReport = async () => {
    if (!session.sessionId) return;
    setLoading(true);
    try {
      const r = await apiClient.downloadReport(session.sessionId);
      const text = await r.data.text();
      setPreview(text);
    } catch {
      alert('Could not generate report.');
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async () => {
    if (!session.sessionId) return;
    const r = await apiClient.downloadReport(session.sessionId);
    const url = URL.createObjectURL(new Blob([await r.data.text()], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CyberShield_Anomaly_Report.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!session.sessionId) return <div className="max-w-4xl mx-auto px-4 py-8"><Alert type="warning">No dataset loaded.</Alert></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader title="Academic Report & Export" subtitle="Auto-generated analysis report with methodology, findings, and limitations." badge="Report" />

      <div className="flex gap-3 mb-6">
        <button onClick={fetchReport} disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 btn-cyber rounded-lg text-sm font-semibold disabled:opacity-50">
          <FileText className="w-4 h-4" />
          {loading ? 'Generating…' : 'Generate Report'}
        </button>
        {preview && (
          <button onClick={downloadReport}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#00d4ff] text-[#060b14] font-bold rounded-lg hover:bg-[#00b8d9] text-sm">
            <Download className="w-4 h-4" />
            Download .md
          </button>
        )}
      </div>

      {loading && <Spinner />}

      {preview && !loading && (
        <div className="cyber-card p-6 fade-in">
          <pre className="whitespace-pre-wrap text-xs text-[#94a3b8] font-mono leading-relaxed">{preview}</pre>
        </div>
      )}

      {/* Viva Questions */}
      <div className="mt-8 space-y-4">
        <h2 className="text-sm font-semibold text-[#64748b] uppercase tracking-wider">Academic Viva Q&A Reference</h2>

        {[
          {
            q: 'Why not use a black-box ML classifier for anomaly detection?',
            a: 'Black-box classifiers (Random Forest, Neural Networks) cannot explain WHY a record was flagged. Z-Score and IQR provide exact mathematical justification (e.g., "Z=4.2σ above mean") which SOC analysts need to triage alerts and which satisfies academic interpretability requirements.'
          },
          {
            q: 'Why must we not claim every anomaly is a cyberattack?',
            a: 'Statistical anomalies reflect rarity relative to the dataset baseline — not confirmed malice. Legitimate large file transfers, OS updates, and video calls routinely produce Z-scores > 3. False positives are inherent; classification requires SOC context.'
          },
          {
            q: 'When is Mann-Whitney U preferred over Welch\'s t-Test?',
            a: 'When normality assumptions are violated (common for network metrics like flow duration or packet rates, which are heavily right-skewed). The Shapiro-Wilk test is used to assess normality; if p < 0.05, the non-parametric Mann-Whitney U is selected.'
          },
          {
            q: 'What is the IQR formula and why is it robust?',
            a: 'IQR = Q3 − Q1. Tukey\'s Fences = [Q1 − 1.5×IQR, Q3 + 1.5×IQR]. Unlike Z-score, IQR does not depend on the mean or standard deviation (which are distorted by extreme outliers), making it resilient to attack-induced contamination of the baseline.'
          },
          {
            q: 'What does the composite anomaly score represent?',
            a: 'A normalized [0–100] index: 60% from normalized Z-deviation magnitude, 40% from IQR violation fraction across features. It is a Statistical Anomaly Score, not an attack probability. Higher scores indicate greater multivariate statistical rarity.'
          },
        ].map((qa, i) => (
          <details key={i} className="cyber-card cursor-pointer">
            <summary className="px-4 py-3 text-sm font-medium text-[#00d4ff] select-none">Q{i + 1}: {qa.q}</summary>
            <div className="px-4 pb-4 text-xs text-[#94a3b8] leading-relaxed border-t border-[#1e3a5f] pt-3">{qa.a}</div>
          </details>
        ))}
      </div>
    </div>
  );
}
