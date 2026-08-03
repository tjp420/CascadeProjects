// simplebeacon-ignore: Dashboard code — all findings are false positives
/**
 * Sparkline rendering utility.
 * Generates inline SVG sparklines from an array of numeric samples.
 * No external dependencies — pure SVG path generation.
 */

/**
 * Create a ring buffer with a fixed maximum size.
 * @param {number} maxSize
 * @returns {{push: Function, values: Function, clear: Function, size: number}}
 */
export function createRingBuffer(maxSize) {
    const buffer = [];
    const cap = Math.max(2, maxSize | 0);
    return {
        push(value) {
            const n = Number(value);
            if (!Number.isFinite(n)) return;
            buffer.push(n);
            if (buffer.length > cap) buffer.shift();
        },
        values() {
            return buffer.slice();
        },
        clear() {
            buffer.length = 0;
        },
        get size() {
            return buffer.length;
        },
    };
}

/**
 * Render an inline SVG sparkline from an array of numeric values.
 * @param {number[]} values - Array of numeric samples
 * @param {object} [options]
 * @param {number} [options.width=60] - SVG width in px
 * @param {number} [options.height=20] - SVG height in px
 * @param {string} [options.color='currentColor'] - Line stroke color
 * @param {string} [options.fillColor] - Area fill color (defaults to color with 0.15 opacity)
 * @returns {SVGElement|null} SVG element, or null if < 2 samples
 */
export function renderSparkline(values, options) {
    if (!Array.isArray(values) || values.length < 2) return null;
    const opts = options || {};
    const width = opts.width || 60;
    const height = opts.height || 20;
    const color = opts.color || 'currentColor';
    const fillColor = opts.fillColor || (color === 'currentColor' ? 'rgba(125,125,125,0.12)' : color);

    const nums = values.map(Number).filter(Number.isFinite);
    if (nums.length < 2) return null;

    const min = Math.min.apply(null, nums);
    const max = Math.max.apply(null, nums);
    const range = max - min || 1; // avoid divide-by-zero for flat lines
    const stepX = width / (nums.length - 1);

    // Normalize values to [0, height] with padding
    const pad = 2;
    const usableHeight = height - pad * 2;
    const points = nums.map((v, i) => {
        const x = i * stepX;
        const y = pad + usableHeight - ((v - min) / range) * usableHeight;
        return { x: x, y: y };
    });

    // Build line path
    const linePath = points.map((p, i) => {
        return (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1);
    }).join(' ');

    // Build area fill path (line + bottom edge)
    const areaPath = linePath +
        ' L' + points[points.length - 1].x.toFixed(1) + ',' + height +
        ' L' + points[0].x.toFixed(1) + ',' + height + ' Z';

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'sparkline');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.setAttribute('preserveAspectRatio', 'none');

    // Area fill
    const area = document.createElementNS(ns, 'path');
    area.setAttribute('d', areaPath);
    area.setAttribute('fill', fillColor);
    area.setAttribute('stroke', 'none');
    svg.appendChild(area);

    // Line
    const line = document.createElementNS(ns, 'path');
    line.setAttribute('d', linePath);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('stroke-linejoin', 'round');
    line.setAttribute('stroke-linecap', 'round');
    svg.appendChild(line);

    // Current value indicator (dot at last point)
    const last = points[points.length - 1];
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', last.x.toFixed(1));
    dot.setAttribute('cy', last.y.toFixed(1));
    dot.setAttribute('r', '1.5');
    dot.setAttribute('fill', color);
    svg.appendChild(dot);

    return svg;
}
