"""
CyberShield — FastAPI Backend
Explainable Network Anomaly Detection Platform
Main application entry point.
"""

import uuid
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from pydantic import BaseModel
from scipy import stats

# ─────────────────────────────────────────────────────────────────────────────
# App setup
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(title="CyberShield API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store (keyed by session_id)
SESSIONS: dict[str, dict[str, Any]] = {}

# Sample data path
SAMPLE_DIR = Path(__file__).parent.parent / "sample_data"


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

FEATURE_ALIASES = {
    "flow_duration": ["flow duration", "dur", "duration"],
    "fwd_packets": ["total fwd packets", "tot fwd pkts", "spkts", "fwd_packets"],
    "bwd_packets": ["total backward packets", "tot bwd pkts", "dpkts", "bwd_packets"],
    "fwd_bytes": ["total length of fwd packets", "totlen fwd pkts", "sbytes"],
    "bwd_bytes": ["total length of bwd packets", "totlen bwd pkts", "dbytes"],
    "flow_bytes_s": ["flow bytes/s", "sload", "flowbyts/s"],
    "flow_packets_s": ["flow packets/s", "rate", "flowpkts/s"],
    "pkt_len_mean": ["packet length mean", "pkt len mean"],
    "pkt_len_std": ["packet length std", "pkt len std"],
    "dst_port": ["destination port", "dst port", "dport"],
    "protocol": ["protocol", "proto", "protocol_type"],
    "label": ["label", "attack_cat", "class", "target", "attack_type"],
}


def sanitize(val: Any) -> Any:
    """Convert non-JSON-serializable values."""
    if val is None:
        return None
    if isinstance(val, (np.bool_,)):
        return bool(val)
    if isinstance(val, bool):
        return val
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating,)):
        f = float(val)
        return None if math.isnan(f) or math.isinf(f) else f
    if isinstance(val, np.ndarray):
        return [sanitize(x) for x in val.tolist()]
    if isinstance(val, dict):
        return {k: sanitize(v) for k, v in val.items()}
    if isinstance(val, list):
        return [sanitize(x) for x in val]
    return val


def safe_json(data: Any) -> JSONResponse:
    return JSONResponse(content=sanitize(data))


def detect_mapping(columns: list[str]) -> dict:
    mapping = {}
    lower_map = {c.strip().lower(): c for c in columns}
    for canonical, aliases in FEATURE_ALIASES.items():
        matched = None
        for alias in aliases:
            if alias in lower_map:
                matched = lower_map[alias]
                break
        mapping[canonical] = matched
    return mapping


def load_df_from_upload(file_bytes: bytes, filename: str) -> pd.DataFrame:
    import io
    ext = Path(filename).suffix.lower()
    if ext == ".csv":
        df = pd.read_csv(io.BytesIO(file_bytes))
    elif ext in (".xlsx", ".xls"):
        df = pd.read_excel(io.BytesIO(file_bytes))
    else:
        raise ValueError(f"Unsupported file type: {ext}")
    df.columns = [str(c).strip() for c in df.columns]
    return df


def quality_report(df: pd.DataFrame) -> dict:
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    total_inf = 0
    for c in num_cols:
        total_inf += int(np.isinf(df[c]).sum())
    return {
        "total_rows": len(df),
        "total_cols": len(df.columns),
        "missing": int(df.isnull().sum().sum()),
        "missing_by_col": {c: int(v) for c, v in df.isnull().sum().items() if v > 0},
        "duplicates": int(df.duplicated().sum()),
        "infinite_values": total_inf,
        "numeric_cols": num_cols,
        "categorical_cols": df.select_dtypes(exclude=[np.number]).columns.tolist(),
    }


def clean_df(df: pd.DataFrame, options: dict) -> tuple[pd.DataFrame, dict]:
    df2 = df.copy()
    changes = {}
    num_cols = df2.select_dtypes(include=[np.number]).columns.tolist()

    if options.get("remove_duplicates"):
        before = len(df2)
        df2 = df2.drop_duplicates().reset_index(drop=True)
        changes["duplicates_removed"] = before - len(df2)

    if options.get("handle_infinities"):
        for c in num_cols:
            n_inf = int(np.isinf(df2[c]).sum())
            if n_inf > 0:
                df2[c] = df2[c].replace([np.inf, -np.inf], np.nan)
        changes["infinities_replaced_with_nan"] = True

    if options.get("handle_missing") == "median":
        for c in num_cols:
            if df2[c].isnull().sum() > 0:
                df2[c] = df2[c].fillna(df2[c].median())
        cat_cols = df2.select_dtypes(exclude=[np.number]).columns
        for c in cat_cols:
            if df2[c].isnull().sum() > 0:
                mode = df2[c].mode()
                df2[c] = df2[c].fillna(mode[0] if len(mode) else "Unknown")
        changes["missing_imputed"] = "median for numeric, mode for categorical"
    elif options.get("handle_missing") == "drop":
        before = len(df2)
        df2 = df2.dropna().reset_index(drop=True)
        changes["rows_dropped_missing"] = before - len(df2)
    elif options.get("handle_missing") == "mean":
        for c in num_cols:
            if df2[c].isnull().sum() > 0:
                df2[c] = df2[c].fillna(df2[c].mean())
        changes["missing_imputed"] = "mean"

    if options.get("clip_negatives"):
        kw = ["duration", "packet", "byte", "rate", "len", "count"]
        for c in num_cols:
            cl = c.lower()
            if any(k in cl for k in kw) and (df2[c] < 0).any():
                df2[c] = df2[c].clip(lower=0)
        changes["negative_values_clipped"] = True

    changes["final_rows"] = len(df2)
    return df2, changes


def compute_descriptive(series: pd.Series) -> dict:
    s = series.dropna().astype(float)
    if len(s) == 0:
        return {}
    q1, q3 = float(np.percentile(s, 25)), float(np.percentile(s, 75))
    return {
        "count": int(len(s)),
        "mean": float(s.mean()),
        "median": float(s.median()),
        "std": float(s.std(ddof=1)) if len(s) > 1 else 0.0,
        "min": float(s.min()),
        "max": float(s.max()),
        "q1": q1,
        "q3": q3,
        "iqr": q3 - q1,
        "skewness": float(stats.skew(s)) if len(s) > 2 else 0.0,
        "kurtosis": float(stats.kurtosis(s)) if len(s) > 3 else 0.0,
    }


def compute_anomaly_flags(
    df: pd.DataFrame,
    features: list[str],
    method: str = "both",
    z_thresh: float = 3.0,
    iqr_mult: float = 1.5,
) -> pd.DataFrame:
    """Compute anomaly flags, Z-scores, IQR bounds for all selected features."""
    result = df.copy()
    result["_z_violations"] = 0
    result["_iqr_violations"] = 0
    result["_max_abs_z"] = 0.0

    for feat in features:
        if feat not in df.columns:
            continue
        s = df[feat].astype(float)
        mu = s.mean()
        sigma = s.std(ddof=1)
        if sigma < 1e-9:
            sigma = 1.0

        z = (s - mu) / sigma
        result[f"__z__{feat}"] = z.round(4)

        q1 = s.quantile(0.25)
        q3 = s.quantile(0.75)
        iqr = q3 - q1
        lb = q1 - iqr_mult * iqr
        ub = q3 + iqr_mult * iqr
        result[f"__lb__{feat}"] = lb
        result[f"__ub__{feat}"] = ub
        result[f"__iqr_flag__{feat}"] = ((s < lb) | (s > ub)).astype(int)

        z_flag = (z.abs() > z_thresh).astype(int)

        if method == "zscore":
            flag = z_flag
        elif method == "iqr":
            flag = result[f"__iqr_flag__{feat}"]
        else:  # both (union)
            flag = ((z_flag == 1) | (result[f"__iqr_flag__{feat}"] == 1)).astype(int)

        result[f"__flag__{feat}"] = flag
        result["_z_violations"] += z_flag
        result["_iqr_violations"] += result[f"__iqr_flag__{feat}"]
        result["_max_abs_z"] = result[["_max_abs_z", z.abs()].copy()[1] if False else "_max_abs_z"].combine(z.abs(), max)

    # Recompute max abs z properly
    z_cols = [f"__z__{f}" for f in features if f"__z__{f}" in result.columns]
    if z_cols:
        result["_max_abs_z"] = result[z_cols].abs().max(axis=1)

    flag_cols = [f"__flag__{f}" for f in features if f"__flag__{f}" in result.columns]
    result["_any_flag"] = (result[flag_cols].sum(axis=1) > 0).astype(int) if flag_cols else 0

    # Composite score [0-100]
    n_feats = len(features) or 1
    z_contrib = (result["_max_abs_z"] / z_thresh).clip(upper=3.0) / 3.0
    iqr_contrib = result["_iqr_violations"] / n_feats
    result["_anomaly_score"] = ((0.6 * z_contrib + 0.4 * iqr_contrib) * 100).clip(0, 100).round(2)

    return result


# ─────────────────────────────────────────────────────────────────────────────
# API Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "app": "CyberShield"}


# ── Upload ────────────────────────────────────────────────────────────────────

@app.post("/api/upload")
async def upload_dataset(file: UploadFile = File(...)):
    content = await file.read()
    try:
        df = load_df_from_upload(content, file.filename)
    except Exception as e:
        raise HTTPException(400, str(e))

    if df.empty:
        raise HTTPException(400, "Uploaded file is empty.")
    if len(df) > 50000:
        df = df.sample(n=50000, random_state=42).reset_index(drop=True)

    session_id = str(uuid.uuid4())
    mapping = detect_mapping(list(df.columns))
    qr = quality_report(df)

    SESSIONS[session_id] = {
        "raw_df": df,
        "clean_df": None,
        "filename": file.filename,
        "mapping": mapping,
        "quality": qr,
        "anomaly_results": None,
        "anomaly_features": [],
        "anomaly_method": "both",
        "z_thresh": 3.0,
    }

    return safe_json({
        "session_id": session_id,
        "filename": file.filename,
        "file_size_bytes": len(content),
        "rows": qr["total_rows"],
        "cols": qr["total_cols"],
        "quality": qr,
        "mapping": mapping,
        "columns": list(df.columns),
        "preview": df.head(10).replace({np.inf: None, -np.inf: None}).where(df.head(10).notna(), None).to_dict(orient="records"),
    })


@app.post("/api/sample")
def load_sample(dataset: str = "cicids"):
    """Load the prebuilt sample dataset."""
    import sys
    backend_dir = Path(__file__).resolve().parent
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    try:
        from generate_sample_data import generate_cicids2017_sample, generate_unsw_sample
    except Exception:
        raise HTTPException(500, "Sample data generator not found.")

    if dataset == "unsw":
        df = generate_unsw_sample(1000)
    else:
        df = generate_cicids2017_sample(1200)

    session_id = str(uuid.uuid4())
    mapping = detect_mapping(list(df.columns))
    qr = quality_report(df)
    SESSIONS[session_id] = {
        "raw_df": df,
        "clean_df": None,
        "filename": f"{dataset}_sample.csv",
        "mapping": mapping,
        "quality": qr,
        "anomaly_results": None,
        "anomaly_features": [],
        "anomaly_method": "both",
        "z_thresh": 3.0,
    }
    return safe_json({
        "session_id": session_id,
        "filename": f"{dataset}_sample.csv",
        "rows": qr["total_rows"],
        "cols": qr["total_cols"],
        "quality": qr,
        "mapping": mapping,
        "columns": list(df.columns),
        "preview": df.head(10).to_dict(orient="records"),
    })


# ── Quality & Cleaning ────────────────────────────────────────────────────────

@app.get("/api/quality/{session_id}")
def get_quality(session_id: str):
    if session_id not in SESSIONS:
        raise HTTPException(404, "Session not found")
    s = SESSIONS[session_id]
    return safe_json({"before": s["quality"]})


class CleanOptions(BaseModel):
    remove_duplicates: bool = True
    handle_missing: str = "median"  # median | mean | drop
    handle_infinities: bool = True
    clip_negatives: bool = True


@app.post("/api/clean/{session_id}")
def clean_dataset(session_id: str, opts: CleanOptions):
    if session_id not in SESSIONS:
        raise HTTPException(404, "Session not found")
    s = SESSIONS[session_id]
    raw = s["raw_df"]
    before_qr = quality_report(raw)
    cleaned, changes = clean_df(raw, opts.model_dump())
    after_qr = quality_report(cleaned)
    s["clean_df"] = cleaned
    # Reset anomaly results
    s["anomaly_results"] = None
    return safe_json({"before": before_qr, "after": after_qr, "changes": changes})


def _get_df(session_id: str) -> pd.DataFrame:
    s = SESSIONS.get(session_id)
    if not s:
        raise HTTPException(404, "Session not found")
    df = s.get("clean_df") if s.get("clean_df") is not None else s.get("raw_df")
    if df is None:
        raise HTTPException(400, "No data loaded")
    return df


# ── EDA ───────────────────────────────────────────────────────────────────────

@app.get("/api/eda/{session_id}/overview")
def eda_overview(session_id: str):
    df = _get_df(session_id)
    s = SESSIONS[session_id]
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()
    return safe_json({
        "rows": len(df),
        "numeric_cols": num_cols,
        "categorical_cols": cat_cols,
        "mapping": s["mapping"],
        "columns": list(df.columns),
    })


@app.get("/api/eda/{session_id}/feature/{feature}")
def eda_feature(session_id: str, feature: str, filter_col: str = None, filter_val: str = None):
    df = _get_df(session_id)
    if feature not in df.columns:
        raise HTTPException(400, f"Feature '{feature}' not found")

    if filter_col and filter_col in df.columns and filter_val:
        df = df[df[filter_col].astype(str) == filter_val]

    is_numeric = pd.api.types.is_numeric_dtype(df[feature])
    if is_numeric:
        stats_d = compute_descriptive(df[feature])
        # Histogram bins
        s = df[feature].dropna().astype(float)
        counts, bin_edges = np.histogram(s, bins=40)
        histogram = [{"bin": f"{bin_edges[i]:.2f}–{bin_edges[i+1]:.2f}", "count": int(counts[i])} for i in range(len(counts))]
        # Box plot data
        q1, q3 = float(np.percentile(s, 25)), float(np.percentile(s, 75))
        iqr = q3 - q1
        whisker_lo = float(s[s >= q1 - 1.5 * iqr].min()) if len(s) else 0
        whisker_hi = float(s[s <= q3 + 1.5 * iqr].max()) if len(s) else 0
        outliers = s[(s < whisker_lo) | (s > whisker_hi)].tolist()[:200]
        return safe_json({
            "type": "numeric",
            "stats": stats_d,
            "histogram": histogram,
            "boxplot": {"min": whisker_lo, "q1": q1, "median": stats_d["median"], "q3": q3, "max": whisker_hi, "outliers": outliers},
        })
    else:
        vc = df[feature].value_counts().head(30)
        return safe_json({
            "type": "categorical",
            "frequency": [{"value": str(k), "count": int(v)} for k, v in vc.items()],
        })


# ── Correlation ────────────────────────────────────────────────────────────────

@app.get("/api/correlation/{session_id}")
def correlation(session_id: str):
    df = _get_df(session_id)
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()[:15]
    sub = df[num_cols].dropna()
    corr_mat = sub.corr(method="pearson")

    pairs = []
    for i in range(len(num_cols)):
        for j in range(i + 1, len(num_cols)):
            r = float(corr_mat.iloc[i, j])
            if not math.isnan(r):
                pairs.append({"a": num_cols[i], "b": num_cols[j], "r": round(r, 4)})
    pairs.sort(key=lambda x: abs(x["r"]), reverse=True)

    # Heatmap data
    heatmap = []
    for i, ci in enumerate(num_cols):
        for j, cj in enumerate(num_cols):
            r = float(corr_mat.loc[ci, cj])
            heatmap.append({"x": ci, "y": cj, "r": round(r, 4) if not math.isnan(r) else 0})

    return safe_json({"features": num_cols, "heatmap": heatmap, "top_pairs": pairs[:20]})


@app.get("/api/correlation/{session_id}/scatter")
def scatter(session_id: str, feat_x: str, feat_y: str):
    df = _get_df(session_id)
    for f in [feat_x, feat_y]:
        if f not in df.columns:
            raise HTTPException(400, f"Feature {f} not found")
    s = df[[feat_x, feat_y]].dropna().head(2000)
    points = [{"x": sanitize(row[feat_x]), "y": sanitize(row[feat_y])} for _, row in s.iterrows()]
    r_val, p_val = stats.pearsonr(s[feat_x].astype(float), s[feat_y].astype(float)) if len(s) >= 3 else (0, 1)
    return safe_json({"points": points, "r": round(float(r_val), 4), "p": round(float(p_val), 6)})


# ── Hypothesis Testing ────────────────────────────────────────────────────────

class HypothesisRequest(BaseModel):
    feature: str
    group_col: str
    group1: str
    group2: str
    test: str = "auto"  # auto | ttest | mannwhitney | chisquare
    alpha: float = 0.05


@app.post("/api/hypothesis/{session_id}")
def hypothesis_test(session_id: str, req: HypothesisRequest):
    df = _get_df(session_id)
    for f in [req.feature, req.group_col]:
        if f not in df.columns:
            raise HTTPException(400, f"Column '{f}' not found")

    g1 = df[df[req.group_col].astype(str) == req.group1][req.feature].dropna().astype(float).values
    g2 = df[df[req.group_col].astype(str) == req.group2][req.feature].dropna().astype(float).values

    if len(g1) < 3 or len(g2) < 3:
        raise HTTPException(400, "Insufficient data in one or both groups (min 3 records needed).")

    # Check normality
    _, p_norm1 = stats.shapiro(g1[:3000]) if len(g1) >= 8 else (0, 0)
    _, p_norm2 = stats.shapiro(g2[:3000]) if len(g2) >= 8 else (0, 0)
    both_normal = (p_norm1 > req.alpha) and (p_norm2 > req.alpha)

    _, lev_p = stats.levene(g1, g2)
    equal_var = lev_p > req.alpha

    chosen = req.test
    if chosen == "auto":
        chosen = "ttest" if both_normal else "mannwhitney"

    if chosen == "ttest":
        t_stat, p_val = stats.ttest_ind(g1, g2, equal_var=equal_var)
        test_name = "Welch's t-Test" if not equal_var else "Student's t-Test"
        stat_label = "t-statistic"
        reject = p_val < req.alpha
        s1p, s2p = np.std(g1, ddof=1), np.std(g2, ddof=1)
        pool = np.sqrt((s1p**2 + s2p**2) / 2)
        effect = float((np.mean(g1) - np.mean(g2)) / pool) if pool > 1e-9 else 0
        effect_label = "Cohen's d"
        h0 = f"There is no significant difference in {req.feature} between {req.group1} and {req.group2}."
        h1 = f"There is a significant difference in {req.feature} between {req.group1} and {req.group2}."
    elif chosen == "mannwhitney":
        u_stat, p_val = stats.mannwhitneyu(g1, g2, alternative="two-sided")
        t_stat = u_stat
        test_name = "Mann-Whitney U Test"
        stat_label = "U-statistic"
        reject = p_val < req.alpha
        effect = float(1 - (2 * u_stat) / (len(g1) * len(g2))) if (len(g1) * len(g2)) > 0 else 0
        effect_label = "Rank-Biserial r"
        h0 = f"The distributions of {req.feature} are identical for {req.group1} and {req.group2}."
        h1 = f"The distributions of {req.feature} systematically differ between {req.group1} and {req.group2}."
    else:
        raise HTTPException(400, "Unsupported test type for continuous feature.")

    return safe_json({
        "test_name": test_name,
        "h0": h0,
        "h1": h1,
        "stat_label": stat_label,
        "test_statistic": float(t_stat),
        "p_value": float(p_val),
        "alpha": req.alpha,
        "reject_null": reject,
        "decision": "Reject H₀" if reject else "Fail to Reject H₀",
        "effect_label": effect_label,
        "effect_size": effect,
        "group1": {"name": req.group1, "n": int(len(g1)), "mean": float(np.mean(g1)), "median": float(np.median(g1)), "std": float(np.std(g1, ddof=1))},
        "group2": {"name": req.group2, "n": int(len(g2)), "mean": float(np.mean(g2)), "median": float(np.median(g2)), "std": float(np.std(g2, ddof=1))},
        "normality_met": both_normal,
        "equal_variance": equal_var,
        "interpretation": (
            f"At α = {req.alpha}, the result is statistically {'significant' if reject else 'not significant'} "
            f"({stat_label} = {float(t_stat):.4f}, p = {float(p_val):.4e}). "
            f"{'We reject H₀ and conclude there is a meaningful difference.' if reject else 'We do not have sufficient evidence to reject H₀.'}"
        ),
    })


# ── Anomaly Detection ─────────────────────────────────────────────────────────

class AnomalyConfig(BaseModel):
    features: list[str]
    method: str = "both"
    z_thresh: float = 3.0
    iqr_mult: float = 1.5


@app.post("/api/anomaly/{session_id}/detect")
def detect_anomalies(session_id: str, cfg: AnomalyConfig):
    df = _get_df(session_id)
    s = SESSIONS[session_id]

    valid_feats = [f for f in cfg.features if f in df.columns and pd.api.types.is_numeric_dtype(df[f])]
    if not valid_feats:
        raise HTTPException(400, "No valid numeric features selected.")

    annotated = compute_anomaly_flags(df, valid_feats, cfg.method, cfg.z_thresh, cfg.iqr_mult)

    s["anomaly_results"] = annotated
    s["anomaly_features"] = valid_feats
    s["anomaly_method"] = cfg.method
    s["z_thresh"] = cfg.z_thresh
    s["iqr_mult"] = cfg.iqr_mult

    total = len(annotated)
    anom = int(annotated["_any_flag"].sum())
    normal = total - anom

    # Score distribution
    score_hist, edges = np.histogram(annotated["_anomaly_score"], bins=20, range=(0, 100))
    score_distribution = [{"bin": f"{edges[i]:.0f}-{edges[i+1]:.0f}", "count": int(score_hist[i])} for i in range(len(score_hist))]

    # Feature violation counts
    feat_violation_counts = []
    for f in valid_feats:
        fc = f"__flag__{f}"
        if fc in annotated.columns:
            feat_violation_counts.append({"feature": f, "violations": int(annotated[fc].sum())})

    return safe_json({
        "total": total,
        "normal": normal,
        "anomalous": anom,
        "anomaly_pct": round(anom / total * 100, 2) if total > 0 else 0,
        "features_used": valid_feats,
        "method": cfg.method,
        "score_distribution": score_distribution,
        "feature_violations": feat_violation_counts,
    })


@app.get("/api/anomaly/{session_id}/records")
def get_anomaly_records(
    session_id: str,
    page: int = 1,
    page_size: int = 50,
    status: str = "all",
    min_score: float = 0,
    search: str = "",
):
    s = SESSIONS.get(session_id)
    if not s or s.get("anomaly_results") is None:
        raise HTTPException(400, "Run anomaly detection first.")

    ann = s["anomaly_results"]
    features = s["anomaly_features"]
    mapping = s["mapping"]
    label_col = mapping.get("label")

    filtered = ann.copy()
    if status == "anomalous":
        filtered = filtered[filtered["_any_flag"] == 1]
    elif status == "normal":
        filtered = filtered[filtered["_any_flag"] == 0]

    filtered = filtered[filtered["_anomaly_score"] >= min_score]

    if search:
        mask = pd.Series([False] * len(filtered), index=filtered.index)
        for col in filtered.select_dtypes(exclude=[np.number]).columns[:5]:
            mask = mask | filtered[col].astype(str).str.contains(search, case=False, na=False)
        filtered = filtered[mask]

    total = len(filtered)
    start = (page - 1) * page_size
    page_df = filtered.iloc[start: start + page_size]

    proto_col = mapping.get("protocol")
    dur_col = mapping.get("flow_duration")
    fwd_p = mapping.get("fwd_packets")
    fwd_b = mapping.get("fwd_bytes")

    records = []
    for idx, row in page_df.iterrows():
        rec = {
            "id": int(idx),
            "protocol": str(row[proto_col]) if proto_col and proto_col in row else "—",
            "duration": sanitize(row[dur_col]) if dur_col and dur_col in row else None,
            "packets": sanitize(row[fwd_p]) if fwd_p and fwd_p in row else None,
            "bytes": sanitize(row[fwd_b]) if fwd_b and fwd_b in row else None,
            "anomaly_score": sanitize(row["_anomaly_score"]),
            "is_anomaly": bool(row["_any_flag"]),
            "label": str(row[label_col]) if label_col and label_col in row else None,
            "z_violations": int(row["_z_violations"]),
            "iqr_violations": int(row["_iqr_violations"]),
        }
        records.append(rec)

    return safe_json({
        "records": records,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": math.ceil(total / page_size) if page_size > 0 else 1,
    })


@app.get("/api/anomaly/{session_id}/explain/{record_id}")
def explain_record(session_id: str, record_id: int):
    s = SESSIONS.get(session_id)
    if not s or s.get("anomaly_results") is None:
        raise HTTPException(400, "Run anomaly detection first.")

    ann = s["anomaly_results"]
    features = s["anomaly_features"]
    df_raw = s.get("clean_df") if s.get("clean_df") is not None else s.get("raw_df")
    mapping = s["mapping"]
    label_col = mapping.get("label")
    z_thresh = s.get("z_thresh", 3.0)

    if record_id not in ann.index:
        raise HTTPException(404, "Record not found.")

    row = ann.loc[record_id]
    base = df_raw.loc[record_id] if record_id in df_raw.index else {}

    feature_evidence = []
    reasons = []
    for feat in features:
        val = sanitize(row.get(feat))
        z = sanitize(row.get(f"__z__{feat}"))
        lb = sanitize(row.get(f"__lb__{feat}"))
        ub = sanitize(row.get(f"__ub__{feat}"))
        iqr_flag = int(row.get(f"__iqr_flag__{feat}", 0))
        flag = int(row.get(f"__flag__{feat}", 0))
        mu = float(df_raw[feat].mean()) if feat in df_raw else None
        std = float(df_raw[feat].std()) if feat in df_raw else None

        evidence = {
            "feature": feat,
            "value": val,
            "z_score": z,
            "iqr_lower": lb,
            "iqr_upper": ub,
            "iqr_violated": bool(iqr_flag),
            "z_violated": bool(z is not None and abs(z) > z_thresh),
            "flagged": bool(flag),
            "baseline_mean": sanitize(mu),
            "baseline_std": sanitize(std),
        }
        feature_evidence.append(evidence)

        if flag:
            direction = "above" if (z or 0) > 0 else "below"
            if z is not None and abs(z) > z_thresh:
                reasons.append(f"{feat} is statistically {direction} normal range (Z = {z:+.2f}, threshold ±{z_thresh}).")
            if iqr_flag:
                ub_s = f"{ub:.2f}" if ub is not None else "upper"
                lb_s = f"{lb:.2f}" if lb is not None else "lower"
                side = f"above IQR upper fence ({ub_s})" if (val or 0) > (ub or 0) else f"below IQR lower fence ({lb_s})"
                reasons.append(f"{feat} is {side}.")

    return safe_json({
        "record_id": record_id,
        "is_anomaly": bool(row["_any_flag"]),
        "anomaly_score": sanitize(row["_anomaly_score"]),
        "label": str(row[label_col]) if label_col and label_col in ann.columns else None,
        "max_abs_z": sanitize(row["_max_abs_z"]),
        "z_violations": int(row["_z_violations"]),
        "iqr_violations": int(row["_iqr_violations"]),
        "reasons": reasons,
        "feature_evidence": feature_evidence,
    })


# ── Network Profile ───────────────────────────────────────────────────────────

@app.get("/api/profile/{session_id}")
def network_profile(session_id: str):
    s = SESSIONS.get(session_id)
    if not s:
        raise HTTPException(404, "Session not found")
    df = _get_df(session_id)
    mapping = s["mapping"]

    proto_col = mapping.get("protocol")
    dst_col = mapping.get("dst_port")
    dur_col = mapping.get("flow_duration")
    pkt_mean_col = mapping.get("pkt_len_mean")
    label_col = mapping.get("label")

    result = {}

    if proto_col and proto_col in df.columns:
        vc = df[proto_col].value_counts().head(10)
        result["protocols"] = [{"name": str(k), "count": int(v)} for k, v in vc.items()]

    if dst_col and dst_col in df.columns:
        vc = df[dst_col].value_counts().head(10)
        result["top_ports"] = [{"port": str(k), "count": int(v)} for k, v in vc.items()]

    if dur_col and dur_col in df.columns:
        result["avg_duration"] = sanitize(df[dur_col].mean())

    if pkt_mean_col and pkt_mean_col in df.columns:
        result["avg_pkt_size"] = sanitize(df[pkt_mean_col].mean())

    if label_col and label_col in df.columns:
        vc = df[label_col].value_counts()
        result["label_distribution"] = [{"label": str(k), "count": int(v)} for k, v in vc.items()]

    ann = s.get("anomaly_results")
    if ann is not None:
        total = len(ann)
        anom = int(ann["_any_flag"].sum())
        result["anomaly_summary"] = {"total": total, "anomalous": anom, "pct": round(anom / total * 100, 2) if total else 0}

    return safe_json(result)


# ── Report ────────────────────────────────────────────────────────────────────

@app.get("/api/report/{session_id}")
def generate_report(session_id: str):
    s = SESSIONS.get(session_id)
    if not s:
        raise HTTPException(404, "Session not found")
    df = _get_df(session_id)
    mapping = s["mapping"]
    ann = s.get("anomaly_results")
    feats = s.get("anomaly_features", [])
    method = s.get("anomaly_method", "both")
    z_thresh = s.get("z_thresh", 3.0)

    lines = [
        "# CyberShield — Network Anomaly Analysis Report",
        "",
        f"**Dataset:** {s.get('filename', 'Unknown')}  ",
        f"**Generated:** {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}  ",
        "",
        "---",
        "",
        "## 1. Executive Summary",
        "",
        "CyberShield analyzed the uploaded network traffic using statistical anomaly detection. "
        "Anomalies reflect statistically unusual behavior — they are **not confirmed cyberattacks**.",
        "",
        "## 2. Dataset Overview",
        "",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Total Records | {len(df):,} |",
        f"| Total Features | {len(df.columns)} |",
        f"| Numeric Features | {len(df.select_dtypes(include=[np.number]).columns)} |",
        f"| Categorical Features | {len(df.select_dtypes(exclude=[np.number]).columns)} |",
        "",
        "## 3. Anomaly Detection Results",
        "",
    ]

    if ann is not None:
        total = len(ann)
        anom = int(ann["_any_flag"].sum())
        pct = round(anom / total * 100, 2) if total else 0
        method_str = {"both": "Z-Score OR IQR (Union)", "zscore": "Z-Score Only", "iqr": "IQR Only"}.get(method, method)
        lines += [
            f"| Method | {method_str} |",
            f"| Z-Score Threshold | ±{z_thresh} |",
            f"| Total Records | {total:,} |",
            f"| Normal Records | {total - anom:,} ({100 - pct:.2f}%) |",
            f"| Statistically Unusual | {anom:,} ({pct:.2f}%) |",
            "",
            "## 4. Feature Analysis",
            "",
        ]
        for f in feats:
            if f in df.columns:
                d = compute_descriptive(df[f])
                lines.append(f"### {f}")
                lines.append(f"Mean: {d.get('mean', 0):.2f}, Std: {d.get('std', 0):.2f}, IQR: {d.get('iqr', 0):.2f}, Skewness: {d.get('skewness', 0):.3f}")
                lines.append("")
    else:
        lines.append("*Anomaly detection was not run in this session.*")
        lines.append("")

    lines += [
        "## 5. Important Limitations",
        "",
        "- Statistical anomalies are not equivalent to security incidents.",
        "- High Z-scores may reflect legitimate network bursts (e.g., backups, video calls).",
        "- IQR-based detection is sensitive to the proportion of outliers in the dataset.",
        "- This tool is for **educational and defensive analysis** purposes only.",
        "",
        "## 6. Academic Methodology",
        "",
        "**Z-Score:** `Z = (x − μ) / σ` — measures standard deviations from the sample mean.",
        "",
        "**IQR Tukey Fences:** `[Q1 − 1.5×IQR, Q3 + 1.5×IQR]` — robust non-parametric bounds.",
        "",
        "**Composite Score:** Weighted blend of normalized Z deviation (60%) and IQR violation fraction (40%), scaled to [0–100].",
    ]

    return PlainTextResponse("\n".join(lines), media_type="text/markdown")


FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"


@app.get("/{path:path}", include_in_schema=False)
def serve_frontend(path: str):
    if path == "api" or path.startswith("api/"):
        raise HTTPException(404, "API endpoint not found")

    frontend_root = FRONTEND_DIST.resolve()
    requested_path = (frontend_root / path).resolve()
    if frontend_root not in requested_path.parents and requested_path != frontend_root:
        raise HTTPException(404, "Not found")

    if requested_path.is_file():
        return FileResponse(requested_path)
    if Path(path).suffix:
        raise HTTPException(404, "Not found")

    index_file = frontend_root / "index.html"
    if not index_file.is_file():
        raise HTTPException(404, "Frontend build not found")
    return FileResponse(index_file)
