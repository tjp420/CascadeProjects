"""Enhanced tests for security scanner module"""


import pytest


from unittest.mock import Mock, patch


from web.api.security_scanner import SecurityScanner


def test_security_scanner_init():


    """Test SecurityScanner initialization"""


    scanner = SecurityScanner()


    assert scanner is not None


def test_security_scanner_dependency_scan():


    """Test dependency vulnerability scanning"""


    scanner = SecurityScanner()


    with patch.object(scanner, 'snyk_client') as mock_snyk:


        mock_snyk.test.return_value = {


            'vulnerabilities': [],


            'ok': True


        }


        result_data = scanner.scan_dependencies('/tmp/test')


        assert 'vulnerabilities' in result_data


def test_security_scanner_sast_scan():


    """Test static application security testing"""


    scanner = SecurityScanner()


    result_data = scanner.scan_sast('/tmp/test')


    assert 'issues' in result_data


def test_security_scanner_secret_scan():


    """Test secret scanning"""


    scanner = SecurityScanner()


    result_data = scanner.scan_secrets('/tmp/test')


    assert 'secrets' in result_data


def test_security_scanner_calculate_score():


    """Test security score calculation"""


    scanner = SecurityScanner()


    scan_results = {


        'dependencies': {'vulnerabilities': []},


        'sast': {'issues': []},


        'secrets': {'secrets': []}


    }


    score = scanner.calculate_security_score(scan_results)


    assert 0 <= score <= 100


def test_security_scanner_with_vulnerabilities():


    """Test security scanner with detected vulnerabilities"""


    scanner = SecurityScanner()


    scan_results = {


        'dependencies': {'vulnerabilities': [{'severity': 'high'}]},


        'sast': {'issues': [{'severity': 'medium'}]},


        'secrets': {'secrets': []}


    }


    score = scanner.calculate_security_score(scan_results)


    assert score < 100


def test_security_scanner_path_validation():


    """Test path validation prevents traversal attacks"""


    scanner = SecurityScanner()


    # Test path traversal prevention


    malicious_path='../../../etc/passwd',


    is_valid= scanner.validate_path(malicious_path)


    assert is_valid is False


def test_security_scanner_empty_directory():


    """Test security scanner on empty directory"""


    scanner = SecurityScanner()


    result_data = scanner.scan_dependencies('/tmp/empty_test_dir')


    assert 'error' in result_data or 'vulnerabilities' in result_data


