'use strict';

/**
 * AI Math Audit — deterministic mathematical audit of AI model numerical logs.
 *
 * JavaScript port of ai-tools/ai-math-audit.py.
 * Runs 4 core debugging methods:
 *   1. Attention-weight hallucination mapping
 *   2. Activation-layer outlier detection (Z-score / IQR)
 *   3. Vector-drift monitoring (Cosine / Euclidean)
 *   4. Execution-trace auditing (loss & gradient flow)
 */

const fs = require('fs');
const path = require('path');

// ── Math Utilities ─────────────────────────────────────────────

function dotProduct(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
    return sum;
}

function l2Norm(a) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i] * a[i];
    return Math.sqrt(sum);
}

function cosineSimilarity(a, b) {
    if (a.length !== b.length) return 0.0;
    const dot = dotProduct(a, b);
    const na = l2Norm(a);
    const nb = l2Norm(b);
    if (na === 0 || nb === 0) return 0.0;
    return dot / (na * nb);
}

function euclideanDistance(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        const d = a[i] - b[i];
        sum += d * d;
    }
    return Math.sqrt(sum);
}

function mean(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr) {
    if (arr.length === 0) return 0;
    const m = mean(arr);
    const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
    return Math.sqrt(variance);
}

function zScore(arr) {
    const m = mean(arr);
    const s = std(arr);
    if (s === 0) return arr.map(() => 0);
    return arr.map(v => (v - m) / s);
}

function percentile(sortedArr, p) {
    if (sortedArr.length === 0) return 0;
    const idx = (p / 100) * (sortedArr.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sortedArr[lo];
    return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (idx - lo);
}

function rowSum(matrix, rowIdx, cols) {
    let sum = 0;
    for (let j = 0; j < cols; j++) sum += matrix[rowIdx * cols + j];
    return sum;
}

// ── 1. Attention-Weight Hallucination Mapping ──────────────────

function auditAttentionWeights(attentionLog, opts) {
    const entropyThreshold = opts.entropy_threshold ?? 2.5;
    const diagDominanceThreshold = opts.diag_dominance_threshold ?? 0.6;
    const findings = [];
    const layers = attentionLog.attention_weights || {};

    for (const [layerName, weightMatrix] of Object.entries(layers)) {
        if (!Array.isArray(weightMatrix) || weightMatrix.length === 0) continue;
        const rows = weightMatrix.length;
        const cols = weightMatrix[0] ? weightMatrix[0].length : 0;
        if (cols === 0) continue;

        // Normalize rows to probability distributions and compute entropy
        const entropies = [];
        for (let i = 0; i < rows; i++) {
            const rs = rowSum(weightMatrix, i, cols) || 1;
            let ent = 0;
            for (let j = 0; j < cols; j++) {
                const p = weightMatrix[i][j] / rs;
                if (p > 0) ent -= p * Math.log(p + 1e-12);
            }
            entropies.push(ent);
        }

        const meanEntropy = mean(entropies);
        const maxEntropy = Math.max(...entropies);

        // Diagonal dominance
        let diagSum = 0;
        let diagCount = 0;
        if (rows === cols) {
            for (let i = 0; i < rows; i++) {
                const rs = rowSum(weightMatrix, i, cols) || 1;
                diagSum += weightMatrix[i][i] / rs;
                diagCount++;
            }
        }
        const diagDominance = diagCount > 0 ? diagSum / diagCount : 0;

        if (meanEntropy > entropyThreshold) {
            findings.push({
                layer: layerName,
                type: 'high_entropy_attention',
                severity: meanEntropy > entropyThreshold * 1.3 ? 'high' : 'medium',
                detail: `Mean attention entropy ${meanEntropy.toFixed(3)} exceeds threshold ${entropyThreshold}`,
                metrics: { mean_entropy: meanEntropy, max_entropy: maxEntropy, diagonal_dominance: diagDominance },
            });
        }

        if (diagDominance < diagDominanceThreshold && rows === cols) {
            findings.push({
                layer: layerName,
                type: 'low_diagonal_dominance',
                severity: 'medium',
                detail: `Diagonal dominance ${diagDominance.toFixed(3)} below threshold ${diagDominanceThreshold}`,
                metrics: { mean_entropy: meanEntropy, max_entropy: maxEntropy, diagonal_dominance: diagDominance },
            });
        }
    }

    return findings;
}

// ── 2. Activation-Layer Outlier Detection ──────────────────────

function auditActivations(activationLog, opts) {
    const zThreshold = opts.z_threshold ?? 3.0;
    const saturationThreshold = opts.saturation_threshold ?? 0.95;
    const findings = [];
    const layers = activationLog.activations || {};

    for (const [layerName, rawValues] of Object.entries(layers)) {
        const v = Array.isArray(rawValues) ? rawValues.flat() : [];
        if (v.length === 0) continue;

        // Z-score outliers
        const zs = zScore(v);
        let outlierCount = 0;
        for (const z of zs) {
            if (Math.abs(z) > zThreshold) outlierCount++;
        }
        const outlierPct = (outlierCount / v.length) * 100;

        if (outlierPct > 1.0) {
            const severity = outlierPct > 5.0 ? 'critical' : outlierPct > 2.0 ? 'high' : 'medium';
            const zMax = Math.max(...zs.map(Math.abs));
            findings.push({
                layer: layerName,
                type: 'activation_outlier',
                severity,
                detail: `${outlierCount} / ${v.length} activations (${outlierPct.toFixed(2)}%) exceed Z-score ±${zThreshold}`,
                metrics: { outlier_count: outlierCount, outlier_pct: outlierPct, z_max: zMax },
            });
        }

        // Saturation check (ReLU-like range 0..1)
        const vMin = Math.min(...v);
        if (vMin >= 0) {
            const saturated = v.filter(x => x > saturationThreshold).length / v.length;
            if (saturated > 0.3) {
                findings.push({
                    layer: layerName,
                    type: 'activation_saturation',
                    severity: 'medium',
                    detail: `${(saturated * 100).toFixed(1)}% of neurons saturated above ${saturationThreshold}`,
                    metrics: { saturation_ratio: saturated, mean_activation: mean(v) },
                });
            }
        }
    }

    return findings;
}

// ── 3. Vector-Drift Monitoring ────────────────────────────────

function auditVectorDrift(embeddingLog, referenceDb, opts) {
    const cosineMin = opts.cosine_min ?? 0.70;
    const euclideanMax = opts.euclidean_max ?? 2.5;
    const findings = [];
    const generated = embeddingLog.embeddings || {};

    if (!referenceDb) {
        const vectors = Object.entries(generated).map(([k, v]) => [k, v]);
        if (vectors.length < 2) return findings;
        const baseline = vectors[0][1];
        for (let i = 1; i < vectors.length; i++) {
            const [key, vec] = vectors[i];
            const cos = cosineSimilarity(vec, baseline);
            const euc = euclideanDistance(vec, baseline);
            if (cos < cosineMin || euc > euclideanMax) {
                findings.push({
                    token: key,
                    type: 'vector_drift',
                    severity: cos < 0.5 ? 'high' : 'medium',
                    detail: `cos=${cos.toFixed(3)}, euc=${euc.toFixed(3)} against baseline`,
                    metrics: { cosine_similarity: cos, euclidean_distance: euc },
                });
            }
        }
        return findings;
    }

    for (const [key, vec] of Object.entries(generated)) {
        const ref = referenceDb[key];
        if (!ref) continue;
        const cos = cosineSimilarity(vec, ref);
        const euc = euclideanDistance(vec, ref);
        if (cos < cosineMin) {
            findings.push({
                token: key,
                type: 'cosine_drift',
                severity: cos < 0.5 ? 'high' : 'medium',
                detail: `Cosine similarity ${cos.toFixed(3)} below threshold ${cosineMin}`,
                metrics: { cosine_similarity: cos, euclidean_distance: euc },
            });
        }
        if (euc > euclideanMax) {
            findings.push({
                token: key,
                type: 'euclidean_drift',
                severity: 'medium',
                detail: `Euclidean distance ${euc.toFixed(3)} exceeds threshold ${euclideanMax}`,
                metrics: { cosine_similarity: cos, euclidean_distance: euc },
            });
        }
    }

    return findings;
}

// ── 4. Execution-Trace Audit ───────────────────────────────────

function auditExecutionTrace(traceLog, opts) {
    const lossSpikeThreshold = opts.loss_spike ?? 2.0;
    const gradNormMax = opts.grad_norm_max ?? 10.0;
    const findings = [];
    const steps = traceLog.trace || [];
    if (!steps.length) return findings;

    const losses = steps.map(s => s.loss ?? 0);
    const gradNorms = steps.map(s => s.grad_norm ?? 0);
    const tokenProbs = steps.map(s => s.token_probabilities || []);

    // Loss spike
    if (losses.length > 1) {
        for (let i = 0; i < losses.length - 1; i++) {
            const diff = losses[i + 1] - losses[i];
            if (Math.abs(diff) > lossSpikeThreshold) {
                findings.push({
                    step: i + 1,
                    type: 'loss_spike',
                    severity: Math.abs(diff) > lossSpikeThreshold * 2 ? 'high' : 'medium',
                    detail: `Loss jumped from ${losses[i].toFixed(4)} to ${losses[i + 1].toFixed(4)} at step ${i + 1}`,
                    metrics: { loss_before: losses[i], loss_after: losses[i + 1], delta: diff },
                });
            }
        }
    }

    // Exploding gradients
    for (let i = 0; i < gradNorms.length; i++) {
        if (gradNorms[i] > gradNormMax) {
            findings.push({
                step: i,
                type: 'exploding_gradient',
                severity: gradNorms[i] > gradNormMax * 5 ? 'critical' : 'high',
                detail: `Gradient norm ${gradNorms[i].toFixed(4)} exceeds threshold ${gradNormMax}`,
                metrics: { grad_norm: gradNorms[i] },
            });
        }
    }

    // Token probability collapse
    for (let stepIdx = 0; stepIdx < tokenProbs.length; stepIdx++) {
        const probs = tokenProbs[stepIdx];
        if (!probs.length) continue;
        const collapsed = probs.filter(p => p > 0 && p < 1e-4).length;
        if (collapsed > 0) {
            const positiveProbs = probs.filter(p => p > 0);
            const minProb = positiveProbs.length > 0 ? Math.min(...positiveProbs) : 0;
            findings.push({
                step: stepIdx,
                type: 'token_probability_collapse',
                severity: 'medium',
                detail: `${collapsed} tokens have near-zero probability at step ${stepIdx}`,
                metrics: { collapsed_tokens: collapsed, min_prob: minProb },
            });
        }
    }

    return findings;
}

// ── I/O & Report Generation ────────────────────────────────────

function loadJsonLogs(logDir) {
    const merged = {};
    const p = path.resolve(logDir);

    let files = [];
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        files = [p];
    } else if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
        files = fs.readdirSync(p)
            .filter(f => /\.jsonl?$/.test(f))
            .sort()
            .map(f => path.join(p, f));
    }

    for (const f of files) {
        const raw = fs.readFileSync(f, 'utf-8');
        if (f.endsWith('.jsonl')) {
            for (const line of raw.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                const obj = JSON.parse(trimmed);
                for (const [k, v] of Object.entries(obj)) {
                    if (Array.isArray(v)) {
                        merged[k] = merged[k] || [];
                        merged[k].push(...v);
                    } else if (!(k in merged)) {
                        merged[k] = v;
                    }
                }
            }
        } else {
            const obj = JSON.parse(raw);
            for (const [k, v] of Object.entries(obj)) {
                if (Array.isArray(v) && k in merged) {
                    merged[k].push(...v);
                } else {
                    merged[k] = v;
                }
            }
        }
    }

    return merged;
}

function runAudit(logSource, opts) {
    const defaults = {
        entropy_threshold: 2.5,
        diag_dominance_threshold: 0.6,
        z_threshold: 3.0,
        saturation_threshold: 0.95,
        cosine_min: 0.70,
        euclidean_max: 2.5,
        loss_spike: 2.0,
        grad_norm_max: 10.0,
    };
    const args = { ...defaults, ...opts };

    const raw = loadJsonLogs(logSource);

    const findingsAttention = auditAttentionWeights(
        { attention_weights: raw.attention_weights || {} },
        args
    );
    const findingsActivation = auditActivations(
        { activations: raw.activations || {} },
        args
    );

    let refDb = null;
    if (args.reference) {
        const refRaw = loadJsonLogs(args.reference);
        refDb = refRaw.embeddings || {};
    }

    const findingsDrift = auditVectorDrift(
        { embeddings: raw.embeddings || {} },
        refDb,
        args
    );
    const findingsTrace = auditExecutionTrace(
        { trace: raw.trace || [] },
        args
    );

    const allFindings = [
        ...findingsAttention,
        ...findingsActivation,
        ...findingsDrift,
        ...findingsTrace,
    ];

    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    allFindings.sort((a, b) =>
        (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99)
    );

    const report = {
        audit_timestamp: new Date().toISOString(),
        source: logSource,
        summary: {
            total_findings: allFindings.length,
            critical: allFindings.filter(f => f.severity === 'critical').length,
            high: allFindings.filter(f => f.severity === 'high').length,
            medium: allFindings.filter(f => f.severity === 'medium').length,
            low: allFindings.filter(f => f.severity === 'low').length,
            attention_findings: findingsAttention.length,
            activation_findings: findingsActivation.length,
            drift_findings: findingsDrift.length,
            trace_findings: findingsTrace.length,
        },
        thresholds_used: {
            entropy_threshold: args.entropy_threshold,
            diag_dominance_threshold: args.diag_dominance_threshold,
            z_threshold: args.z_threshold,
            saturation_threshold: args.saturation_threshold,
            cosine_min: args.cosine_min,
            euclidean_max: args.euclidean_max,
            loss_spike: args.loss_spike,
            grad_norm_max: args.grad_norm_max,
        },
        findings: allFindings,
        visualizations: [],
    };

    return report;
}

module.exports = {
    runAudit,
    loadJsonLogs,
    cosineSimilarity,
    euclideanDistance,
    zScore,
    auditAttentionWeights,
    auditActivations,
    auditVectorDrift,
    auditExecutionTrace,
};
