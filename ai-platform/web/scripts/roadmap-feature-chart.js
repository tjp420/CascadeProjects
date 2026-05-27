/**
 * Feature breakdown chart for the development roadmap section (requires Chart.js)
 */
(function () {
    function initializeCharts() {
        const featureBreakdownCtx = document.getElementById('featureBreakdownChart');
        if (!featureBreakdownCtx) {
            return;
        }

        if (window.featureBreakdownChartInstance) {
            window.featureBreakdownChartInstance.destroy();
        }

        window.featureBreakdownChartInstance = new Chart(featureBreakdownCtx, {
            type: 'bar',
            data: {
                labels: ['AI Tools', 'Analytics', 'Development Tools', 'Infrastructure'],
                datasets: [{
                    label: 'Completed',
                    data: [17, 13, 9, 5],
                    backgroundColor: '#10b981'
                }, {
                    label: 'In Progress',
                    data: [3, 5, 1, 6],
                    backgroundColor: '#f59e0b'
                }, {
                    label: 'Pending',
                    data: [0, 0, 0, 0],
                    backgroundColor: '#6b7280'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#e2e8f0'
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        ticks: { color: '#94a3b8' },
                        grid: { color: '#334155' }
                    },
                    y: {
                        stacked: true,
                        ticks: { color: '#94a3b8' },
                        grid: { color: '#334155' }
                    }
                }
            }
        });
    }

    window.initializeCharts = initializeCharts;
})();
