#!/usr/bin/env python3
"""
audit_viz.py — Visualization helpers for ai-math-audit.py

Generates deterministic matplotlib charts from AI model numerical logs:
  - Attention-weight heatmaps
  - Activation distribution histograms with Z-score overlay
  - 2D PCA vector-drift scatter plots
  - Loss-curve / gradient-norm time-series plots
"""

import base64
import io
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for server / headless use

import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from matplotlib.colors import LinearSegmentedColormap

# ── Colour palette (dark-theme friendly) ───────────────────────
_PALETTE = sns.color_palette("husl", 8)
_BG = "#0f172a"
_FG = "#e2e8f0"
_GRID = "#334155"


def _setup_dark_axes(ax) -> None:
    """Apply dark-theme styling to an Axes object."""
    ax.set_facecolor(_BG)
    ax.tick_params(colors=_FG)
    for spine in ax.spines.values():
        spine.set_color(_GRID)
    ax.xaxis.label.set_color(_FG)
    ax.yaxis.label.set_color(_FG)
    ax.title.set_color(_FG)


def _save_or_encode(fig, output_path: Optional[str] = None, dpi: int = 150) -> Optional[str]:
    """Save figure to disk or return base64 PNG string."""
    if output_path:
        fig.savefig(output_path, dpi=dpi, bbox_inches='tight', facecolor=_BG)
        plt.close(fig)
        return None
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=dpi, bbox_inches='tight', facecolor=_BG)
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode('utf-8')


# ── 1. Attention-Weight Heatmap ─────────────────────────────────

def plot_attention_heatmap(
    weight_matrix: List[List[float]],
    layer_name: str,
    output_path: Optional[str] = None,
) -> Optional[str]:
    """
    Render a labelled heatmap of an attention-weight matrix.
    Returns base64 PNG string if output_path is None, else saves to disk.
    """
    w = np.array(weight_matrix, dtype=np.float64)
    if w.ndim != 2 or w.shape[0] == 0:
        return None

    # Row-normalise to probability distribution
    row_sums = w.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1
    p = w / row_sums

    fig, ax = plt.subplots(figsize=(10, 8), facecolor=_BG)
    _setup_dark_axes(ax)

    # Custom dark-friendly colormap
    cmap = LinearSegmentedColormap.from_list("sb_dark", ["#0f172a", "#06b6d4", "#f59e0b"])

    sns.heatmap(
        p,
        cmap=cmap,
        linewidths=0.5,
        linecolor=_GRID,
        square=True,
        cbar_kws={'label': 'Attention weight'},
        ax=ax,
    )
    ax.set_title(f"Attention Weights — {layer_name}", fontsize=14, pad=12)
    ax.set_xlabel("Key position")
    ax.set_ylabel("Query position")

    # If matrix is small enough, label ticks
    if p.shape[0] <= 32:
        ax.set_xticks(np.arange(p.shape[1]) + 0.5)
        ax.set_yticks(np.arange(p.shape[0]) + 0.5)
        ax.set_xticklabels([str(i) for i in range(p.shape[1])], fontsize=7, color=_FG)
        ax.set_yticklabels([str(i) for i in range(p.shape[0])], fontsize=7, color=_FG)

    return _save_or_encode(fig, output_path)


# ── 2. Activation Distribution Histogram ──────────────────────

def plot_activation_distribution(
    values: List[float],
    layer_name: str,
    output_path: Optional[str] = None,
    z_threshold: float = 3.0,
) -> Optional[str]:
    """
    Render a histogram of activation values with Z-score overlay.
    """
    v = np.array(values, dtype=np.float64).flatten()
    if v.size == 0:
        return None

    mean = float(np.mean(v))
    std = float(np.std(v))
    zs = (v - mean) / std if std != 0 else np.zeros_like(v)

    fig, ax = plt.subplots(figsize=(10, 5), facecolor=_BG)
    _setup_dark_axes(ax)

    # Histogram
    n, bins, patches = ax.hist(v, bins=80, color="#06b6d4", edgecolor=_GRID, alpha=0.7)

    # Z-score threshold lines
    lower = mean - z_threshold * std
    upper = mean + z_threshold * std
    ax.axvline(lower, color="#f59e0b", linestyle='--', linewidth=1.5, label=f'Z = -{z_threshold}')
    ax.axvline(upper, color="#f59e0b", linestyle='--', linewidth=1.5, label=f'Z = +{z_threshold}')

    # Highlight outlier bars
    for patch, left_edge in zip(patches, bins[:-1]):
        if left_edge < lower or left_edge > upper:
            patch.set_facecolor("#ef4444")
            patch.set_alpha(0.9)

    ax.set_title(f"Activation Distribution — {layer_name}", fontsize=14, pad=12)
    ax.set_xlabel("Activation value")
    ax.set_ylabel("Count")
    ax.legend(facecolor=_BG, edgecolor=_GRID, labelcolor=_FG)

    return _save_or_encode(fig, output_path)


# ── 3. Vector-Drift PCA Scatter Plot ───────────────────────────

def plot_vector_drift(
    baseline: List[float],
    vectors: Dict[str, List[float]],
    output_path: Optional[str] = None,
    cosine_min: float = 0.70,
    euclidean_max: float = 2.5,
) -> Optional[str]:
    """
    Render a 2D PCA scatter plot of embedding vectors against a baseline.
    Points outside the drift boundary are coloured red.
    """
    from sklearn.decomposition import PCA

    base = np.array(baseline, dtype=np.float64)
    names = list(vectors.keys())
    vecs = np.array([vectors[k] for k in names], dtype=np.float64)
    if vecs.shape[0] == 0:
        return None

    # Combine baseline + vectors for PCA
    all_vecs = np.vstack([base.reshape(1, -1), vecs])
    pca = PCA(n_components=2)
    projected = pca.fit_transform(all_vecs)

    fig, ax = plt.subplots(figsize=(10, 8), facecolor=_BG)
    _setup_dark_axes(ax)

    # Plot baseline
    ax.scatter(projected[0, 0], projected[0, 1], s=300, c="#06b6d4", marker='*',
               edgecolors=_FG, linewidths=1.5, zorder=5, label='Baseline')

    # Plot each vector, colour by drift status
    for i, name in enumerate(names):
        vec = vecs[i]
        cos = _cosine(vec, base)
        euc = _euclidean(vec, base)
        drifted = cos < cosine_min or euc > euclidean_max
        colour = "#ef4444" if drifted else "#22c55e"
        ax.scatter(projected[i + 1, 0], projected[i + 1, 1], s=120, c=colour,
                   edgecolors=_FG, linewidths=0.5, alpha=0.85)
        if drifted:
            ax.annotate(name, (projected[i + 1, 0], projected[i + 1, 1]),
                        fontsize=7, color="#fca5a5", xytext=(5, 5),
                        textcoords='offset points')

    ax.set_title(f"Vector Drift (PCA) — {len(names)} vectors", fontsize=14, pad=12)
    ax.set_xlabel(f"PC1 ({pca.explained_variance_ratio_[0]*100:.1f}%)")
    ax.set_ylabel(f"PC2 ({pca.explained_variance_ratio_[1]*100:.1f}%)")

    # Legend
    from matplotlib.lines import Line2D
    legend_elements = [
        Line2D([0], [0], marker='*', color='w', markerfacecolor='#06b6d4',
               markersize=15, label='Baseline'),
        Line2D([0], [0], marker='o', color='w', markerfacecolor='#22c55e',
               markersize=10, label='Within bounds'),
        Line2D([0], [0], marker='o', color='w', markerfacecolor='#ef4444',
               markersize=10, label='Drifted'),
    ]
    ax.legend(handles=legend_elements, facecolor=_BG, edgecolor=_GRID, labelcolor=_FG)

    return _save_or_encode(fig, output_path)


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    dot = float(np.dot(a, b))
    na = float(np.linalg.norm(a))
    nb = float(np.linalg.norm(b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _euclidean(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.linalg.norm(a - b))


# ── 4. Loss-Curve / Gradient-Norm Time-Series Plot ────────────

def plot_loss_trace(
    trace_steps: List[Dict[str, Any]],
    output_path: Optional[str] = None,
    loss_spike_threshold: float = 2.0,
) -> Optional[str]:
    """
    Render a dual-axis time-series plot of loss and gradient norm.
    """
    if not trace_steps:
        return None

    losses = np.array([s.get("loss", 0) for s in trace_steps], dtype=np.float64)
    grad_norms = np.array([s.get("grad_norm", 0) for s in trace_steps], dtype=np.float64)
    steps = np.arange(len(trace_steps))

    fig, ax1 = plt.subplots(figsize=(12, 5), facecolor=_BG)
    ax1.set_facecolor(_BG)
    ax1.tick_params(colors=_FG)
    for spine in ax1.spines.values():
        spine.set_color(_GRID)
    ax1.xaxis.label.set_color(_FG)
    ax1.yaxis.label.set_color(_FG)
    ax1.title.set_color(_FG)

    # Loss curve
    ax1.plot(steps, losses, color="#06b6d4", linewidth=1.5, label="Loss")
    ax1.set_xlabel("Step")
    ax1.set_ylabel("Loss", color="#06b6d4")
    ax1.tick_params(axis='y', labelcolor="#06b6b4")

    # Loss spike shading
    if losses.size > 1:
        diffs = np.abs(np.diff(losses))
        spike_idx = np.where(diffs > loss_spike_threshold)[0]
        for idx in spike_idx:
            ax1.axvspan(idx, idx + 1, color="#f59e0b", alpha=0.25)

    # Gradient norm on secondary axis
    ax2 = ax1.twinx()
    ax2.set_facecolor(_BG)
    ax2.tick_params(colors=_FG)
    for spine in ax2.spines.values():
        spine.set_color(_GRID)
    ax2.yaxis.label.set_color(_FG)
    ax2.plot(steps, grad_norms, color="#ef4444", linewidth=1.2, linestyle='--', label="Grad norm")
    ax2.set_ylabel("Gradient norm", color="#ef4444")
    ax2.tick_params(axis='y', labelcolor="#ef4444")

    # Combined legend
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, facecolor=_BG,
               edgecolor=_GRID, labelcolor=_FG, loc='upper right')

    ax1.set_title("Execution Trace — Loss & Gradient Norm", fontsize=14, pad=12)

    return _save_or_encode(fig, output_path)


# ── Batch generation from a report JSON ───────────────────────

def generate_all_visualizations(
    report: Dict[str, Any],
    viz_dir: str,
) -> List[Dict[str, str]]:
    """
    Given a full audit report dict, generate every available chart and
    return a list of {type, path} records.
    """
    out = Path(viz_dir)
    out.mkdir(parents=True, exist_ok=True)
    generated: List[Dict[str, str]] = []

    raw = report.get("_raw_logs", {})

    # 1. Attention heatmaps
    attn = raw.get("attention_weights", {})
    for layer_name, matrix in attn.items():
        safe_name = layer_name.replace("/", "_").replace(" ", "_")
        path = out / f"attention_{safe_name}.png"
        if plot_attention_heatmap(matrix, layer_name, str(path)) is not None:
            generated.append({"type": "attention_heatmap", "layer": layer_name, "path": str(path)})

    # 2. Activation histograms
    acts = raw.get("activations", {})
    for layer_name, values in acts.items():
        safe_name = layer_name.replace("/", "_").replace(" ", "_")
        path = out / f"activation_{safe_name}.png"
        if plot_activation_distribution(values, layer_name, str(path)) is not None:
            generated.append({"type": "activation_histogram", "layer": layer_name, "path": str(path)})

    # 3. Vector drift PCA
    emb = raw.get("embeddings", {})
    if emb:
        items = list(emb.items())
        baseline = items[0][1]
        vectors = {k: v for k, v in items[1:]}
        if vectors:
            path = out / "vector_drift_pca.png"
            if plot_vector_drift(baseline, vectors, str(path)) is not None:
                generated.append({"type": "vector_drift_pca", "path": str(path)})

    # 4. Loss trace
    trace = raw.get("trace", [])
    if trace:
        path = out / "loss_trace.png"
        if plot_loss_trace(trace, str(path)) is not None:
            generated.append({"type": "loss_trace", "path": str(path)})

    return generated
