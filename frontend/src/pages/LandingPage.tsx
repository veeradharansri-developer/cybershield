import { useNavigate } from 'react-router-dom';
import { Shield, Upload, Search, AlertTriangle, FileText, ChevronRight, CheckCircle } from 'lucide-react';
import apiClient from '../api';
import { useSession } from '../context/SessionContext';

const steps = [
  { icon: '📤', label: 'UPLOAD', desc: 'CSV or Excel network traffic file' },
  { icon: '🧹', label: 'CLEAN', desc: 'Validate and sanitize data' },
  { icon: '📊', label: 'ANALYZE', desc: 'Statistics, distributions, correlations' },
  { icon: '🛡️', label: 'DETECT', desc: 'Z-score & IQR anomaly detection' },
  { icon: '🔍', label: 'EXPLAIN', desc: 'Per-record explainable attribution' },
  { icon: '📑', label: 'REPORT', desc: 'Download analysis report' },
];

const features = [
  { icon: Shield, title: 'Statistical Foundation', desc: 'Z-Score, IQR Tukey\'s Fences, Modified Z-Score (MAD) — transparent mathematical methods.' },
  { icon: Search, title: 'Record-Level Explainability', desc: 'Every flagged flow reveals exact Z-scores, IQR bounds, and plain-English reasoning.' },
  { icon: AlertTriangle, title: 'Honest Anomaly Classification', desc: 'CyberShield identifies statistical rarity, not confirmed attacks. Benign bursts are common.' },
  { icon: FileText, title: 'Academic-Grade Report', desc: 'Auto-generated markdown report with methodology, formulas, and limitations.' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { setSession } = useSession();

  const handleSample = async (dataset: 'cicids' | 'unsw') => {
    try {
      const res = await apiClient.loadSample(dataset);
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
      navigate('/upload');
    } catch (e) {
      alert('Could not load sample dataset. Make sure the backend is running.');
    }
  };

  return (
    <div className="min-h-screen scan-bg">
      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Shield icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00d4ff15] to-[#00ff8815] border border-[#00d4ff30] flex items-center justify-center animate-border">
              <Shield className="w-10 h-10 text-[#00d4ff]" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-6xl font-black tracking-tight mb-3">
            <span className="text-white">CYBER</span>
            <span className="text-[#00d4ff] text-glow-cyan">SHIELD</span>
          </h1>
          <p className="text-[#64748b] text-lg font-medium mb-6 tracking-widest uppercase">
            Explainable Network Anomaly Detection
          </p>
          <p className="text-[#94a3b8] text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Understand unusual network behavior through <span className="text-[#00d4ff]">statistical analysis</span>.
            Detect anomalies with <span className="text-[#00ff88]">mathematical transparency</span>.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-wrap gap-4 justify-center mb-6">
            <button
              onClick={() => navigate('/upload')}
              className="flex items-center gap-2 px-6 py-3 bg-[#00d4ff] text-[#060b14] font-bold rounded-lg hover:bg-[#00b8d9] transition-all hover:shadow-lg hover:shadow-[#00d4ff30] text-sm"
            >
              <Upload className="w-4 h-4" />
              Upload Dataset
            </button>
            <button
              onClick={() => handleSample('cicids')}
              className="flex items-center gap-2 px-6 py-3 btn-cyber rounded-lg font-semibold text-sm"
            >
              Try CICIDS-2017 Sample
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleSample('unsw')}
              className="flex items-center gap-2 px-6 py-3 btn-cyber rounded-lg font-semibold text-sm"
            >
              Try UNSW-NB15 Sample
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-[#475569] max-w-lg mx-auto">
            ⚠️ CyberShield identifies statistically unusual network behavior. It does not independently confirm malicious activity.
            This tool is intended for educational and defensive network analysis.
          </p>
        </div>
      </section>

      {/* Workflow Steps */}
      <section className="py-16 px-4 border-y border-[#1e3a5f]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-xs uppercase tracking-widest text-[#64748b] mb-10">Analysis Workflow</h2>
          <div className="flex flex-wrap justify-center items-center gap-2">
            {steps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-2">
                <div className="cyber-card px-4 py-3 text-center min-w-28">
                  <div className="text-2xl mb-1">{step.icon}</div>
                  <div className="text-xs font-bold text-[#00d4ff] tracking-wider">{step.label}</div>
                  <div className="text-xs text-[#475569] mt-0.5">{step.desc}</div>
                </div>
                {i < steps.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-[#1e3a5f] shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-xs uppercase tracking-widest text-[#64748b] mb-10">Core Capabilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="cyber-card p-6 flex gap-4 hover:border-[#00d4ff30] transition-all">
                <div className="w-10 h-10 rounded-lg bg-[#00d4ff10] border border-[#00d4ff20] flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-[#00d4ff]" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm mb-1">{title}</h3>
                  <p className="text-[#64748b] text-xs leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Formulas */}
      <section className="py-16 px-4 bg-[#060b14] border-t border-[#1e3a5f]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-xs uppercase tracking-widest text-[#64748b] mb-8">Mathematical Foundation</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: 'Z-Score', formula: 'Z = (x − μ) / σ', desc: 'Parametric detection. Flags when |Z| > threshold (default 3.0).' },
              { name: 'IQR Tukey Fence', formula: '[Q1 − 1.5·IQR, Q3 + 1.5·IQR]', desc: 'Non-parametric bounds. Robust to skewed traffic distributions.' },
              { name: 'Modified Z-Score', formula: 'M = 0.6745·(x − x̃) / MAD', desc: 'MAD-based detection. Resistant to contamination by extreme values.' },
            ].map(f => (
              <div key={f.name} className="cyber-card p-5 text-center">
                <div className="text-xs text-[#64748b] mb-2 uppercase tracking-wider">{f.name}</div>
                <code className="text-[#00ff88] text-sm font-mono block mb-3">{f.formula}</code>
                <p className="text-xs text-[#475569] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-[#1e3a5f] text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <CheckCircle className="w-3 h-3 text-[#00ff88]" />
          <span className="text-xs text-[#475569]">Defensive Cybersecurity Tool — For Educational & Academic Use</span>
        </div>
        <p className="text-xs text-[#334155]">Statistical anomaly detection is not a substitute for professional security monitoring.</p>
      </footer>
    </div>
  );
}
