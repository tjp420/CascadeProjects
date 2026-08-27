/**
 * Canvas line chart for team gate pass rate trend (0–100%).
 */
export class TeamGatePassTrendChart {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }

  render(trend = [], _options = {}) {
    const data =
      Array.isArray(trend) && trend.length
        ? trend
        : [
            {
              date: new Date().toISOString().slice(0, 10),
              gate_pass_rate: 0,
              scan_count: 0,
            },
          ];
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width;
    const h = rect.height;
    const pad = { top: 16, right: 16, bottom: 28, left: 44 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const styles = getComputedStyle(document.documentElement);
    const border = styles.getPropertyValue("--border").trim() || "#334155";
    const text = styles.getPropertyValue("--text-muted").trim() || "#94a3b8";
    const primary = styles.getPropertyValue("--success").trim() || "#10b981";
    const muted =
      styles.getPropertyValue("--text-secondary").trim() || "#64748b";

    this.ctx.clearRect(0, 0, w, h);

    const points = data.map((d, i) => ({
      x: pad.left + (i / Math.max(data.length - 1, 1)) * chartW,
      y:
        pad.top +
        chartH -
        Math.min(1, Math.max(0, Number(d.gate_pass_rate) || 0)) * chartH,
      label: d.date
        ? new Date(d.date + "T12:00:00").toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })
        : "",
      rate: Number(d.gate_pass_rate) || 0,
      scans: Number(d.scan_count) || 0,
    }));

    this.ctx.strokeStyle = border;
    this.ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (i / 4) * chartH;
      this.ctx.beginPath();
      this.ctx.moveTo(pad.left, y);
      this.ctx.lineTo(pad.left + chartW, y);
      this.ctx.stroke();
      this.ctx.fillStyle = muted;
      this.ctx.font = "10px system-ui, sans-serif";
      this.ctx.textAlign = "right";
      this.ctx.fillText(`${100 - i * 25}%`, pad.left - 6, y + 3);
    }

    if (points.length > 1) {
      const grad = this.ctx.createLinearGradient(
        0,
        pad.top,
        0,
        pad.top + chartH,
      );
      grad.addColorStop(0, primary + "40");
      grad.addColorStop(1, primary + "05");
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.moveTo(points[0].x, pad.top + chartH);
      points.forEach((p) => this.ctx.lineTo(p.x, p.y));
      this.ctx.lineTo(points[points.length - 1].x, pad.top + chartH);
      this.ctx.closePath();
      this.ctx.fill();
    }

    this.ctx.strokeStyle = primary;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) {
        this.ctx.moveTo(p.x, p.y);
      } else {
        this.ctx.lineTo(p.x, p.y);
      }
    });
    this.ctx.stroke();

    points.forEach((p) => {
      this.ctx.fillStyle = primary;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.fillStyle = text;
    this.ctx.font = "11px system-ui, sans-serif";
    this.ctx.textAlign = "center";
    const labelIdx = [
      0,
      Math.floor(points.length / 2),
      points.length - 1,
    ].filter((v, i, a) => a.indexOf(v) === i);
    labelIdx.forEach((i) => {
      if (points[i]?.label) {
        this.ctx.fillText(points[i].label, points[i].x, h - 8);
      }
    });
  }
}

/**
 * @param {HTMLElement} container
 * @param {Array} trend
 * @returns {(() => void)|null}
 */
export function mountTeamGatePassTrendChart(container, trend) {
  const canvas = container.querySelector("#team-gate-trend-canvas");
  if (!canvas) {
    return null;
  }
  const chart = new TeamGatePassTrendChart(canvas);
  chart.render(trend);
  const onResize = () => chart.render(trend);
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}
