import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

export interface UploadResponse {
  session_id: string;
  filename: string;
  file_size_bytes: number;
  rows: number;
  cols: number;
  quality: QualityReport;
  mapping: Record<string, string | null>;
  columns: string[];
  preview: Record<string, unknown>[];
}

export interface QualityReport {
  total_rows: number;
  total_cols: number;
  missing: number;
  missing_by_col: Record<string, number>;
  duplicates: number;
  infinite_values: number;
  numeric_cols: string[];
  categorical_cols: string[];
}

export interface CleanOptions {
  remove_duplicates: boolean;
  handle_missing: 'median' | 'mean' | 'drop';
  handle_infinities: boolean;
  clip_negatives: boolean;
}

export interface AnomalyConfig {
  features: string[];
  method: 'both' | 'zscore' | 'iqr';
  z_thresh: number;
  iqr_mult: number;
}

export interface AnomalyResults {
  total: number;
  normal: number;
  anomalous: number;
  anomaly_pct: number;
  features_used: string[];
  method: string;
  score_distribution: { bin: string; count: number }[];
  feature_violations: { feature: string; violations: number }[];
}

export interface RecordRow {
  id: number;
  protocol: string;
  duration: number | null;
  packets: number | null;
  bytes: number | null;
  anomaly_score: number;
  is_anomaly: boolean;
  label: string | null;
  z_violations: number;
  iqr_violations: number;
}

export interface AnomalyExplanation {
  record_id: number;
  is_anomaly: boolean;
  anomaly_score: number;
  label: string | null;
  max_abs_z: number;
  z_violations: number;
  iqr_violations: number;
  reasons: string[];
  feature_evidence: {
    feature: string;
    value: number | null;
    z_score: number | null;
    iqr_lower: number | null;
    iqr_upper: number | null;
    iqr_violated: boolean;
    z_violated: boolean;
    flagged: boolean;
    baseline_mean: number | null;
    baseline_std: number | null;
  }[];
}

export interface HypothesisResult {
  test_name: string;
  h0: string;
  h1: string;
  stat_label: string;
  test_statistic: number;
  p_value: number;
  alpha: number;
  reject_null: boolean;
  decision: string;
  effect_label: string;
  effect_size: number;
  group1: { name: string; n: number; mean: number; median: number; std: number };
  group2: { name: string; n: number; mean: number; median: number; std: number };
  normality_met: boolean;
  equal_variance: boolean;
  interpretation: string;
}

const apiClient = {
  uploadFile: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<UploadResponse>('/upload', form);
  },

  loadSample: (dataset: 'cicids' | 'unsw' = 'cicids') =>
    api.post<UploadResponse>(`/sample?dataset=${dataset}`),

  getQuality: (sessionId: string) =>
    api.get<{ before: QualityReport }>(`/quality/${sessionId}`),

  cleanData: (sessionId: string, opts: CleanOptions) =>
    api.post(`/clean/${sessionId}`, opts),

  getEDAOverview: (sessionId: string) =>
    api.get(`/eda/${sessionId}/overview`),

  getFeatureStats: (sessionId: string, feature: string, filterCol?: string, filterVal?: string) => {
    const params = new URLSearchParams();
    if (filterCol) params.append('filter_col', filterCol);
    if (filterVal) params.append('filter_val', filterVal);
    return api.get(`/eda/${sessionId}/feature/${encodeURIComponent(feature)}?${params}`);
  },

  getCorrelation: (sessionId: string) =>
    api.get(`/correlation/${sessionId}`),

  getScatter: (sessionId: string, featX: string, featY: string) =>
    api.get(`/correlation/${sessionId}/scatter?feat_x=${encodeURIComponent(featX)}&feat_y=${encodeURIComponent(featY)}`),

  runHypothesisTest: (sessionId: string, data: {
    feature: string; group_col: string; group1: string; group2: string;
    test: string; alpha: number;
  }) => api.post<HypothesisResult>(`/hypothesis/${sessionId}`, data),

  detectAnomalies: (sessionId: string, cfg: AnomalyConfig) =>
    api.post<AnomalyResults>(`/anomaly/${sessionId}/detect`, cfg),

  getAnomalyRecords: (sessionId: string, params: {
    page?: number; page_size?: number; status?: string; min_score?: number; search?: string;
  }) => api.get(`/anomaly/${sessionId}/records`, { params }),

  explainRecord: (sessionId: string, recordId: number) =>
    api.get<AnomalyExplanation>(`/anomaly/${sessionId}/explain/${recordId}`),

  getNetworkProfile: (sessionId: string) =>
    api.get(`/profile/${sessionId}`),

  downloadReport: (sessionId: string) =>
    api.get(`/report/${sessionId}`, { responseType: 'blob' }),
};

export default apiClient;
