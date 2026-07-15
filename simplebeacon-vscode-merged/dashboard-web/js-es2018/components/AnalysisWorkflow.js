import { escapeHtml } from '../utils.js';

const STEPS = [
    { id: 'target', label: 'Choose target' },
    { id: 'scan', label: 'Run analysis' },
    { id: 'review', label: 'Review findings' },
    { id: 'act', label: 'Export & remediate' }
];

/** Resolve the active workflow step from app state. */
export function resolveAnalysisWorkflowStep(state, extras = {}) {
    const busy = extras.busy || (state && state.scanning);
    const hasResult = extras.hasResult || !!(state && state.report);
    if (hasResult)
        return 'review';
    if (busy)
        return 'scan';
    const hasPath = state && (state.lastProjectPath || state.defaultProjectPath);
    return hasPath ? 'scan' : 'target';
}

/** Horizontal step indicator shared by Dashboard and Analyze pages. */
export function renderAnalysisWorkflow(activeStep, options = {}) {
    const stepIndex = Math.max(0, STEPS.findIndex((s) => s.id === activeStep));
    const pageLabel = options.pageLabel || '';
    return `
    <div class="analysis-workflow" aria-label="Analysis workflow">
      ${pageLabel ? `<div class="analysis-workflow-page">${escapeHtml(pageLabel)}</div>` : ''}
      <ol class="analysis-workflow-steps">
        ${STEPS.map((step, index) => {
        let cls = 'analysis-workflow-step';
        if (index < stepIndex)
            cls += ' is-complete';
        else if (index === stepIndex)
            cls += ' is-active';
        return `
            <li class="${cls}">
              <span class="analysis-workflow-num" aria-hidden="true">${index + 1}</span>
              <span class="analysis-workflow-label">${escapeHtml(step.label)}</span>
            </li>`;
    }).join('')}
      </ol>
    </div>`;
}
