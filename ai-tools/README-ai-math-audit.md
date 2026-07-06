# ai-math-audit.py — Deterministic AI Model Log Auditor

A traditional, non-AI analysis program that audits the **strict mathematics** of an AI model's processing pipeline to catch hallucinations, bias, and output corruption.

## What It Does

Instead of analyzing text or images conceptually, this script reads the **raw numerical logs** generated during an AI inference run (attention matrices, activation values, embedding vectors, loss curves) and applies deterministic statistical checks to flag exactly where the math went wrong.

## The 4 Debugging Methods

### 1. Attention-Weight Hallucination Mapping
- Computes row-wise entropy of attention probability matrices
- Measures diagonal dominance (self-attention strength)
- **Flags**: High entropy (unfocused attention) + low diagonal dominance (not anchoring on source tokens)

### 2. Activation-Layer Outlier Detection
- Runs Z-score analysis across hidden-layer activation logs
- Detects saturated neurons (values pinned near max)
- **Flags**: Anomalous firing patterns, dying ReLUs, bias-induced saturation

### 3. Vector-Drift Monitoring
- Computes Cosine Similarity and Euclidean Distance between generated embeddings and verified baselines
- **Flags**: Semantic drift (cosine drops) and magnitude drift (distance spikes)

### 4. Execution-Trace Audit
- Tracks loss curves, gradient norms, and token probabilities step-by-step
- **Flags**: Loss spikes, exploding gradients, token probability collapse

## Quick Start

```bash
# Install dependency
pip install numpy

# Audit a single log file
python ai-math-audit.py --log-file sample-model-log.json --verbose

# Audit all logs in a directory
python ai-math-audit.py --log-dir ./model-logs --output audit-report.json

# Use a verified reference baseline for drift detection
python ai-math-audit.py --log-file run.json --reference baseline.json --verbose

# Tighten thresholds for stricter auditing
python ai-math-audit.py --log-file run.json --z-threshold 2.0 --loss-spike 1.0
```

## Input Log Format

The script expects JSON files with these top-level keys:

```json
{
  "attention_weights": {
    "layer_0_head_0": [[0.4, 0.3, ...], ...],
    ...
  },
  "activations": {
    "layer_0_ff": [0.1, 0.9, 0.95, ...]
  },
  "embeddings": {
    "token_the": [0.12, 0.34, ...]
  },
  "trace": [
    {"step": 0, "loss": 2.45, "grad_norm": 1.2, "token_probabilities": [0.3, 0.2, ...]}
  ]
}
```

## Output Report

The script produces a structured JSON report:

```json
{
  "audit_timestamp": "2026-07-03T12:14:00Z",
  "summary": {
    "total_findings": 12,
    "critical": 0,
    "high": 1,
    "medium": 8,
    "low": 3
  },
  "findings": [
    {
      "layer": "layer_1_head_0",
      "type": "high_entropy_attention",
      "severity": "high",
      "detail": "Mean attention entropy 3.12 exceeds threshold 2.5",
      "metrics": {"mean_entropy": 3.12, "diagonal_dominance": 0.31}
    }
  ]
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Clean — no issues above medium |
| 1 | High-severity findings detected |
| 2 | Critical-severity findings detected |

## Tunable Thresholds

| Flag | Default | Description |
|------|---------|-------------|
| `--entropy-threshold` | 2.5 | Attention entropy ceiling |
| `--diag-dominance-threshold` | 0.6 | Minimum diagonal dominance ratio |
| `--z-threshold` | 3.0 | Z-score outlier boundary |
| `--saturation-threshold` | 0.95 | Activation saturation level |
| `--cosine-min` | 0.70 | Minimum cosine similarity vs baseline |
| `--euclidean-max` | 2.5 | Maximum euclidean distance vs baseline |
| `--loss-spike` | 2.0 | Loss delta that triggers a spike flag |
| `--grad-norm-max` | 10.0 | Gradient norm explosion threshold |

## Integration with SimpleBeacon

This tool can be wired into the SimpleBeacon VS Code: extension scan pipeline to provide a deterministic, mathematical audit layer alongside the existing rule-based and structural scans.
