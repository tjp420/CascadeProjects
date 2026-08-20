module.exports = {
    ci: {
        collect: {
            // Build and audit the production distribution folder statically
            staticDistDir: './assets',
            numberOfRuns: 3,
            settings: {
                chromeFlags: '--no-sandbox --headless --disable-gpu'
            }
        },
        assert: {
            // Establish direct score baselines and performance budgets
            assertions: {
                'categories:performance': ['error', { minScore: 0.9 }],
                'categories:accessibility': ['error', { minScore: 0.95 }],
                'categories:best-practices': ['error', { minScore: 0.9 }],
                // Enforce strict asset delivery size budgets
                'resource-summary:script:size': ['error', { maxNumericValue: 3000000 }], // 3MB overall JS cap (relaxed)
                'resource-summary:total:size': ['error', { maxNumericValue: 4500000 }], // 4.5MB overall page weight cap (relaxed)
                'dom-size': ['error', { maxNumericValue: 2000 }] // guard DOM node bloat
            }
        },
        upload: {
            // Upload results to temporary public storage for quick review
            target: 'temporary-public-storage'
        }
    }
};
