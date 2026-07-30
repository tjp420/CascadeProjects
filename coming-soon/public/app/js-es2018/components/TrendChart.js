/**
 * Trend chart.
 */
export class TrendChart {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }
    render(history, _options = {}) {
        const data = history.length ? history : [{ date: new Date().toISOString(), issueCount: 0, qualityScore: 99 }];
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        const w = rect.width;
        const h = rect.height;
        const pad = { top: 16, right: 16, bottom: 28, left: 40 };
        const chartW = w - pad.left - pad.right;
        const chartH = h - pad.top - pad.bottom;
        const styles = getComputedStyle(document.documentElement);
        const border = styles.getPropertyValue('--border').trim() || '#334155';
        const text = styles.getPropertyValue('--text-muted').trim() || '#94a3b8';
        const primary = styles.getPropertyValue('--primary').trim() || '#6366f1';
        const success = styles.getPropertyValue('--success').trim() || '#10b981';
        this.ctx.clearRect(0, 0, w, h);
        const maxIssues = Math.max(1, ...data.map((d) => { var _a; return (_a = d.issueCount) !== null && _a !== void 0 ? _a : 0; }));
        const points = data.map((d, i) => {
            var _a;
            return ({
                x: pad.left + (i / Math.max(data.length - 1, 1)) * chartW,
                y: pad.top + chartH - (((_a = d.issueCount) !== null && _a !== void 0 ? _a : 0) / maxIssues) * chartH,
                label: d.date ? new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''
            });
        });
        // Grid lines
        this.ctx.strokeStyle = border;
        this.ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = pad.top + (i / 4) * chartH;
            this.ctx.beginPath();
            this.ctx.moveTo(pad.left, y);
            this.ctx.lineTo(pad.left + chartW, y);
            this.ctx.stroke();
        }
        // Area fill
        if (points.length > 1) {
            const grad = this.ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
            grad.addColorStop(0, primary + '40');
            grad.addColorStop(1, primary + '05');
            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.moveTo(points[0].x, pad.top + chartH);
            points.forEach((p) => this.ctx.lineTo(p.x, p.y));
            this.ctx.lineTo(points[points.length - 1].x, pad.top + chartH);
            this.ctx.closePath();
            this.ctx.fill();
        }
        // Line
        this.ctx.strokeStyle = primary;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        points.forEach((p, i) => {
            if (i === 0)
                this.ctx.moveTo(p.x, p.y);
            else
                this.ctx.lineTo(p.x, p.y);
        });
        this.ctx.stroke();
        // Dots
        points.forEach((p) => {
            var _a;
            this.ctx.fillStyle = data.length === 1 && ((_a = data[0].issueCount) !== null && _a !== void 0 ? _a : 0) === 0 ? success : primary;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
        });
        // X labels (first, middle, last)
        this.ctx.fillStyle = text;
        this.ctx.font = '11px system-ui, sans-serif';
        const labelIdx = [0, Math.floor(points.length / 2), points.length - 1].filter((v, i, a) => a.indexOf(v) === i);
        labelIdx.forEach((i) => {
            var _a;
            if ((_a = points[i]) === null || _a === void 0 ? void 0 : _a.label) {
                this.ctx.fillText(points[i].label, points[i].x - 16, h - 8);
            }
        });
        // Y axis label
        this.ctx.save();
        this.ctx.translate(12, pad.top + chartH / 2);
        this.ctx.rotate(-Math.PI / 2);
        this.ctx.fillText('Issues', 0, 0);
        this.ctx.restore();
    }
}
/**
 * Render trend section.
 * @param {any} history
 * @returns {any}
 */
export function renderTrendSection(history) {
    return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Trend Analysis</span>
        <span class="text-muted" style="font-size: var(--font-size-sm)">Last ${history.length || 1} scan(s)</span>
      </div>
      <div class="trend-chart">
        <canvas id="trend-canvas"></canvas>
      </div>
      <div class="trend-legend">
        <div class="trend-legend-item">
          <span class="trend-legend-dot" style="background: var(--primary)"></span>
          Issue count
        </div>
        <div class="trend-legend-item">
          <span class="trend-legend-dot" style="background: var(--success)"></span>
          Healthy (0 issues)
        </div>
      </div>
    </div>
  `;
}
/**
 * Mount trend chart.
 * @param {any} container
 * @param {any} history
 * @returns {any}
 */
export function mountTrendChart(container, history) {
    const canvas = container.querySelector('#trend-canvas');
    if (!canvas)
        return null;
    const chart = new TrendChart(canvas);
    chart.render(history);
    /**
     * On resize.
     * @returns {any}
     */
    const onResize = () => chart.render(history);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
}
