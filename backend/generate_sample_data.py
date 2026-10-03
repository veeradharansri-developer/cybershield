"""
generate_sample_data.py — Synthetic network traffic dataset generator.
Produces realistic CICIDS-2017 and UNSW-NB15 style DataFrames for demo.
"""

import numpy as np
import pandas as pd


def _rng(seed=42):
    return np.random.default_rng(seed)


def generate_cicids2017_sample(n: int = 1200) -> pd.DataFrame:
    """Generate a CICIDS-2017 style sample with mix of normal and attack traffic."""
    rng = _rng()
    n_normal = int(n * 0.75)
    n_attack = n - n_normal

    def _normal_flows(k):
        return pd.DataFrame({
            "Flow Duration": rng.exponential(scale=50000, size=k).clip(0),
            "Total Fwd Packets": rng.poisson(lam=8, size=k).clip(0),
            "Total Backward Packets": rng.poisson(lam=6, size=k).clip(0),
            "Total Length of Fwd Packets": rng.exponential(scale=500, size=k).clip(0),
            "Total Length of Bwd Packets": rng.exponential(scale=400, size=k).clip(0),
            "Flow Bytes/s": rng.exponential(scale=80000, size=k).clip(0),
            "Flow Packets/s": rng.exponential(scale=500, size=k).clip(0),
            "Packet Length Mean": rng.normal(loc=400, scale=200, size=k).clip(0),
            "Packet Length Std": rng.exponential(scale=150, size=k).clip(0),
            "Destination Port": rng.choice([80, 443, 22, 53, 8080, 3306, 21, 25], size=k),
            "Protocol": rng.choice(["TCP", "UDP", "ICMP"], size=k, p=[0.7, 0.25, 0.05]),
            "Label": "BENIGN",
        })

    def _attack_flows(k):
        attack_types = rng.choice(["DoS Hulk", "PortScan", "FTP-Patator", "SSH-Patator"], size=k)
        return pd.DataFrame({
            "Flow Duration": rng.exponential(scale=2000, size=k).clip(0),
            "Total Fwd Packets": rng.poisson(lam=60, size=k).clip(0),
            "Total Backward Packets": rng.poisson(lam=2, size=k).clip(0),
            "Total Length of Fwd Packets": rng.exponential(scale=50, size=k).clip(0),
            "Total Length of Bwd Packets": rng.exponential(scale=30, size=k).clip(0),
            "Flow Bytes/s": rng.exponential(scale=2_000_000, size=k).clip(0),
            "Flow Packets/s": rng.exponential(scale=50000, size=k).clip(0),
            "Packet Length Mean": rng.exponential(scale=50, size=k).clip(0),
            "Packet Length Std": rng.exponential(scale=40, size=k).clip(0),
            "Destination Port": rng.choice([80, 443, 22, 21], size=k),
            "Protocol": rng.choice(["TCP", "UDP"], size=k, p=[0.8, 0.2]),
            "Label": attack_types,
        })

    df = pd.concat([_normal_flows(n_normal), _attack_flows(n_attack)], ignore_index=True)
    # Shuffle
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    # Inject ~3% missing values
    for col in ["Packet Length Std", "Flow Bytes/s"]:
        mask = rng.random(len(df)) < 0.03
        df.loc[mask, col] = np.nan
    # Inject ~1% infinite values
    mask = rng.random(len(df)) < 0.01
    df.loc[mask, "Flow Bytes/s"] = np.inf
    return df


def generate_unsw_sample(n: int = 1000) -> pd.DataFrame:
    """Generate a UNSW-NB15 style sample."""
    rng = _rng(seed=7)
    n_normal = int(n * 0.70)
    n_attack = n - n_normal

    attack_types = rng.choice(
        ["Normal", "Generic", "Exploits", "Fuzzers", "DoS", "Reconnaissance", "Backdoor"],
        size=n_attack
    )

    normal = pd.DataFrame({
        "dur": rng.exponential(0.5, n_normal),
        "spkts": rng.poisson(8, n_normal),
        "dpkts": rng.poisson(6, n_normal),
        "sbytes": rng.exponential(3000, n_normal),
        "dbytes": rng.exponential(2000, n_normal),
        "rate": rng.exponential(50, n_normal),
        "sload": rng.exponential(5000, n_normal),
        "dload": rng.exponential(3000, n_normal),
        "pkt len mean": rng.normal(350, 150, n_normal).clip(0),
        "pkt len std": rng.exponential(120, n_normal),
        "dport": rng.choice([80, 443, 22, 53, 3306], n_normal),
        "proto": rng.choice(["tcp", "udp", "icmp"], n_normal, p=[0.65, 0.30, 0.05]),
        "attack_cat": "Normal",
    })

    attacks = pd.DataFrame({
        "dur": rng.exponential(0.05, n_attack),
        "spkts": rng.poisson(80, n_attack),
        "dpkts": rng.poisson(3, n_attack),
        "sbytes": rng.exponential(500, n_attack),
        "dbytes": rng.exponential(50, n_attack),
        "rate": rng.exponential(5000, n_attack),
        "sload": rng.exponential(800000, n_attack),
        "dload": rng.exponential(5000, n_attack),
        "pkt len mean": rng.exponential(40, n_attack),
        "pkt len std": rng.exponential(30, n_attack),
        "dport": rng.choice([80, 443, 22, 21, 8080], n_attack),
        "proto": rng.choice(["tcp", "udp"], n_attack, p=[0.75, 0.25]),
        "attack_cat": attack_types,
    })

    df = pd.concat([normal, attacks], ignore_index=True)
    df = df.sample(frac=1, random_state=7).reset_index(drop=True)
    # Inject some missing/invalid
    mask = rng.random(len(df)) < 0.02
    df.loc[mask, "rate"] = np.nan
    return df


if __name__ == "__main__":
    df = generate_cicids2017_sample(500)
    print(df.shape, df["Label"].value_counts().to_dict())
    df2 = generate_unsw_sample(500)
    print(df2.shape, df2["attack_cat"].value_counts().to_dict())
