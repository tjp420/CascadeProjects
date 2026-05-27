// Auto-generated mock data scan results
// Generated: 2026-05-18T18:11:23.159Z

export const mockDataScanResults = {
    'generated': '2026-05-18T18:11:23.159Z',
    'filesScanned': 218,
    'filesWithFindings': 102,
    'totalFindings': 707,
    'healthScore': 30,
    'healthGrade': 'F',
    'healthStatus': 'Critical',
    'categories': {
        'test_data': {
            'count': 371,
            'description': 'Test data patterns'
        },
        'mock_functions': {
            'count': 222,
            'description': 'Mock function patterns'
        },
        'test_emails': {
            'count': 85,
            'description': 'Test email patterns'
        },
        'test_databases': {
            'count': 13,
            'description': 'Test database patterns'
        },
        'test_apis': {
            'count': 9,
            'description': 'Test API patterns'
        },
        'test_phones': {
            'count': 7,
            'description': 'Test phone patterns'
        },
        'generic_placeholders': {
            'count': 0,
            'description': 'Generic placeholder patterns'
        }
    },
    'severity': {
        'high': 22,
        'medium': 646,
        'low': 39
    },
    'topFiles': [
        {
            'file': 'DataEngine.test.js',
            'matchCount': 31,
            'highSeverityCount': 0
        },
        {
            'file': 'dashboard.integration.test.js',
            'matchCount': 22,
            'highSeverityCount': 0
        },
        {
            'file': 'exportData.test.js',
            'matchCount': 22,
            'highSeverityCount': 0
        },
        {
            'file': 'dashboard.test.js',
            'matchCount': 21,
            'highSeverityCount': 0
        },
        {
            'file': 'utils.test.js',
            'matchCount': 21,
            'highSeverityCount': 0
        }
    ],
    'remediationImpact': {
        'totalFindings': {
            'baseline': 1088,
            'current': 707,
            'reduction': 381,
            'percentage': 35
        },
        'mockFunctions': {
            'baseline': 546,
            'current': 222,
            'reduction': 324,
            'percentage': 59
        },
        'testEmails': {
            'baseline': 134,
            'current': 85,
            'reduction': 49,
            'percentage': 37
        },
        'highSeverity': {
            'baseline': 21,
            'current': 22,
            'reduction': -1,
            'percentage': -5
        }
    },
    'recommendations': [
        {
            'priority': 'high',
            'title': 'Continue Focused Remediation',
            'description': '707 findings remain - targeted approach recommended',
            'action': 'Focus on test_data category for biggest impact'
        },
        {
            'priority': 'medium',
            'title': 'Health Score Improvement',
            'description': 'Health score is 30% - improvement needed',
            'action': 'Complete standardization of remaining mock patterns'
        }
    ]
};

export default mockDataScanResults;
