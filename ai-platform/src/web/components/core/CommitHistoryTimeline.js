/**
 * Commit History Timeline Component
 * Visualizes commit history using D3.js timeline visualization
 */

export class CommitHistoryTimeline {
    constructor() {
        this.timelineData = null;
    }

    /**
     * Analyze git history and build timeline data
     */
    async analyzeCommitHistory(projectPath) {
        console.log('📅 Building commit timeline...');
        
        // Simulated commit data (in real implementation, this would come from git API)
        const commits = [];
        const authors = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
        const messageTypes = ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore'];
        
        // Generate 30 simulated commits over the last 30 days
        for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            
            commits.push({
                id: `commit-${i}`,
                author: authors[Math.floor(Math.random() * authors.length)],
                date: date,
                message: `${messageTypes[Math.floor(Math.random() * messageTypes.length)]}: ${this.generateRandomMessage()}`,
                filesChanged: Math.floor(Math.random() * 10) + 1,
                additions: Math.floor(Math.random() * 100) + 10,
                deletions: Math.floor(Math.random() * 50) + 1
            });
        }
        
        this.timelineData = {
            commits: commits,
            totalCommits: commits.length,
            authors: this.getAuthorStats(commits),
            dateRange: {
                start: commits[commits.length - 1].date,
                end: commits[0].date
            }
        };
        
        console.log(`✅ Commit timeline built: ${commits.length} commits`);
        return this.timelineData;
    }

    /**
     * Generate random commit message
     */
    generateRandomMessage() {
        const messages = [
            'Add new feature',
            'Fix authentication issue',
            'Update documentation',
            'Refactor code structure',
            'Add unit tests',
            'Optimize performance',
            'Update dependencies',
            'Fix styling issues',
            'Add error handling',
            'Improve user experience'
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }

    /**
     * Get author statistics
     */
    getAuthorStats(commits) {
        const stats = {};
        commits.forEach(commit => {
            if (!stats[commit.author]) {
                stats[commit.author] = {
                    count: 0,
                    additions: 0,
                    deletions: 0
                };
            }
            stats[commit.author].count++;
            stats[commit.author].additions += commit.additions;
            stats[commit.author].deletions += commit.deletions;
        });
        return stats;
    }

    /**
     * Render timeline using D3.js
     */
    renderTimeline(containerId, width = 800, height = 400) {
        console.log('🎨 Rendering commit timeline...');
        
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('❌ Container not found:', containerId);
            return;
        }
        
        // Clear previous timeline
        container.textContent = '' /* Replaced innerHTML with textContent for safety */
        
        // Create SVG
        const svg = d3.select(`#${containerId}`)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('font', '10px sans-serif');
        
        // Time scale
        const timeScale = d3.scaleTime()
            .domain([
                this.timelineData.dateRange.start,
                this.timelineData.dateRange.end
            ])
            .range([50, width - 50]);
        
        // Y scale for authors
        const authors = Object.keys(this.timelineData.authors);
        const yScale = d3.scaleBand()
            .domain(authors)
            .range([50, height - 50])
            .padding(0.2);
        
        // Color scale for authors
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
        
        // Draw axis
        const xAxis = d3.axisBottom(timeScale).ticks(10);
        const yAxis = d3.axisLeft(yScale);
        
        svg.append('g')
            .attr('transform', `translate(0, ${height - 30})`)
            .call(xAxis);
        
        svg.append('g')
            .attr('transform', 'translate(50, 0)')
            .call(yAxis);
        
        // Draw commit dots
        const dots = svg.selectAll('.commit')
            .data(this.timelineData.commits)
            .enter()
            .append('circle')
            .attr('cx', d => timeScale(d.date))
            .attr('cy', d => yScale(d.author) + yScale.bandwidth() / 2)
            .attr('r', 6)
            .attr('fill', d => colorScale(d.author))
            .attr('opacity', 0.7)
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .attr('r', 10)
                    .attr('opacity', 1);
                
                const tooltip = d3.select('body').append('div')
                    .attr('class', 'timeline-tooltip')
                    .style('position', 'absolute')
                    .style('background', 'rgba(0,0,0,0.8)')
                    .style('color', 'white')
                    .style('padding', '10px')
                    .style('border-radius', '4px')
                    .style('font-size', '12px')
                    .style('z-index', '1000')
                    .html(`
                        <strong>${d.author}</strong><br>
                        ${d.date.toLocaleDateString()}<br>
                        ${d.message}<br>
                        Files: ${d.filesChanged} | +${d.additions} -${d.deletions}
                    `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
                
                d3.select(this).on('mouseout.tooltip', function() {
                    tooltip.remove();
                });
            })
            .on('mouseout', function() {
                d3.select(this)
                    .attr('r', 6)
                    .attr('opacity', 0.7);
            });
        
        // Add title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .text('Commit History Timeline');
        
        // Add legend
        const legend = svg.append('g')
            .attr('transform', `translate(${width - 150}, 20)`);
        
        authors.forEach((author, i) => {
            const legendRow = legend.append('g')
                .attr('transform', `translate(0, ${i * 20})`);
            
            legendRow.append('circle')
                .attr('r', 6)
                .attr('fill', colorScale(author));
            
            legendRow.append('text')
                .attr('x', 15)
                .attr('y', 4)
                .text(`${author} (${this.timelineData.authors[author].count})`);
        });
        
        console.log('✅ Commit timeline rendered');
        
        return svg;
    }

    /**
     * Filter commits by author
     */
    filterByAuthor(author) {
        if (author === 'all') {
            return this.timelineData.commits;
        }
        return this.timelineData.commits.filter(c => c.author === author);
    }

    /**
     * Filter commits by date range
     */
    filterByDateRange(startDate, endDate) {
        return this.timelineData.commits.filter(c => 
            c.date >= startDate && c.date <= endDate
        );
    }

    /**
     * Export timeline as image
     */
    exportAsImage(containerId, filename = 'commit-timeline.png') {
        const svg = document.querySelector(`#${containerId} svg`);
        if (!svg) {
            console.warn('⚠️ SVG not found in container', containerId, '- visualization may not be rendered yet');
            return;
        }
        
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.setAttribute('src', 'data:image/svg+xml;base64,' + btoa(svgData));
        
        img.onload = function() {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            const png = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = filename;
            link.href = png;
            link.click();
        };
    }
}
