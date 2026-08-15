module.exports = {
  ci: {
    collect: {
      // Audit the dashboard page from the prepared serving directory
      staticDistDir: './lighthouse-dist',
      url: ['/dashboard/'],
      numberOfRuns: 3,
      isSinglePageApplication: true,
      settings: {
        chromeFlags: '--no-sandbox --headless --disable-gpu',
        maxWaitForLoad: 60000,
      },
    },
    assert: {
      // Establish direct score baselines and performance budgets
      assertions: {
        'categories:performance': ['warn', { minScore: 0.90 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['warn', { minScore: 0.90 }],
        // Enforce strict asset delivery size budgets
        'resource-summary:script:size': ['error', { maxNumericValue: 3000000 }], // 3MB overall JS cap (relaxed)
        'resource-summary:total:size': ['error', { maxNumericValue: 4500000 }],  // 4.5MB overall page weight cap (relaxed)
        'dom-size': ['error', { maxNumericValue: 2000 }],                         // guard DOM node bloat
      },
    },
    upload: {
      // Upload results to temporary public storage for quick review
      target: 'temporary-public-storage',
    },
  },
};
