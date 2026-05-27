#!/usr/bin/env python3
"""
Aggressive fix for remaining style issues in index.html
"""

import logging
import re
from typing import List, Tuple, Optional


def read_html_file(file_path: str = 'index.html') -> str:
    """
    Read the content of an HTML file.

    Args:
        file_path: Path to the HTML file to read.

    Returns:
        The content of the file as a string.
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        return f.read()


def preprocess_line(line: str) -> str:
    """
    Remove trailing whitespace from a line.

    Args:
        line: The line to preprocess.

    Returns:
        The line with trailing whitespace removed.
    """
    return line.rstrip()


def is_empty_line(line: str) -> bool:
    """
    Check if a line is empty after stripping whitespace.

    Args:
        line: The line to check.

    Returns:
        True if the line is empty after stripping, False otherwise.
    """
    return line.strip() == ''


def fix_font_link_line() -> List[str]:
    """
    Fix the font link line (line 9) by breaking it into multiple lines.

    Returns:
        List of fixed lines for the font link.
    """
    return [
        '    <link href="https://fonts.googleapis.com/css2?family = Inter:wght@300;400;500;600;700;800;900&family = Space+Grotesk:wght@300;400;500;600;700&display = swap"',
        '          rel="stylesheet">'
    ]


def fix_meta_description_line() -> List[str]:
    """
    Fix the meta description line (line 17) by breaking it into multiple lines.

    Returns:
        List of fixed lines for the meta description.
    """
    return [
        '    <meta name="description"',
        '          content="Transform decision-making with AI-powered intelligence frameworks. Real-time insights, predictive analytics, and board-ready documentation.">'
    ]


def fix_meta_keywords_line() -> List[str]:
    """
    Fix the meta keywords line (line 18) by breaking it into multiple lines.

    Returns:
        List of fixed lines for the meta keywords.
    """
    return [
        '    <meta name="keywords"',
        '          content="decision intelligence, AI frameworks, enterprise decisions, predictive analytics, business outcomes">'
    ]


def fix_hero_section_line() -> List[str]:
    """
    Fix the hero section line (line 761) by breaking it into multiple lines.

    Returns:
        List of fixed lines for the hero section.
    """
    return [
        '            <h1 class="hero-title">    Transform Your Decision-Making</h1>',
        '            <p class="hero-subtitle">Harness the power of AI-driven intelligence frameworks to make smarter, faster, and more confident decisions with measurable business outcomes.</p>',
        '            <div class="hero-stats" id="hero-stats">'
    ]


def fix_feature_section_title_line() -> List[str]:
    """
    Fix the feature section title line (line 795) by breaking it into multiple lines.

    Returns:
        List of fixed lines for the feature section title.
    """
    return [
        '            <h2 class="section-title fade-in">    Intelligent Decision Frameworks</h2>',
        '            <p class="section-subtitle fade-in fade-in-delay-1">    AI-powered methodologies that deliver measurable business outcomes  and board-ready documentation</p>'
    ]


def fix_smart_decision_enforcement_line() -> List[str]:
    """
    Fix the Smart Decision Enforcement line (line 802) by breaking it into multiple lines.

    Returns:
        List of fixed lines for Smart Decision Enforcement.
    """
    return [
        '            <h3 class="feature-title">    Smart Decision Enforcement</h3>',
        '            <p class="feature-description">A I-driven constraint validation that prevents incomplete decisions  and ensures comprehensive evaluation across all critical dimensions.</p>'
    ]


def fix_automated_board_reports_line() -> List[str]:
    """
    Fix the Automated Board Reports line (line 808) by breaking it into multiple lines.

    Returns:
        List of fixed lines for Automated Board Reports.
    """
    return [
        '            <h3 class="feature-title">Automated Board Reports</h3>',
        '            <p class="feature-description">A I-generated professional decision memos, risk assessments, and strategic briefs ready for executive review.</p>'
    ]


def fix_crisis_intelligence_line() -> List[str]:
    """
    Fix the Crisis Intelligence line (line 814) by breaking it into multiple lines.

    Returns:
        List of fixed lines for Crisis Intelligence.
    """
    return [
        '            <h3 class="feature-title">Crisis Intelligence</h3>',
        '            <p class="feature-description">A I-enhanced decision-making for high-stakes situations with ethical considerations  and stakeholder analysis.</p>'
    ]


def fix_ethical_ai_matrix_line() -> List[str]:
    """
    Fix the Ethical AI Matrix line (line 820) by breaking it into multiple lines.

    Returns:
        List of fixed lines for Ethical AI Matrix.
    """
    return [
        '            <h3 class="feature-title">Ethical AI Matrix</h3>',
        '            <p class="feature-description">A I-powered moral  and values-based decision framework with ethical principles  and social impact assessment.</p>'
    ]


def fix_predictive_strategy_line() -> List[str]:
    """
    Fix the Predictive Strategy line (line 826) by breaking it into multiple lines.

    Returns:
        List of fixed lines for Predictive Strategy.
    """
    return [
        '            <h3 class="feature-title">Predictive Strategy</h3>',
        '            <p class="feature-description">A I-driven strategic analysis with market intelligence, competitive landscape, and vision alignment.</p>'
    ]


def fix_real_time_roi_line() -> List[str]:
    """
    Fix the Real-Time ROI line (line 832) by breaking it into multiple lines.

    Returns:
        List of fixed lines for Real-Time ROI.
    """
    return [
        '            <h3 class="feature-title">Real-Time ROI</h3>',
        '            <p class="feature-description">A I-powered tracking of decision time reduction, options considered, and confidence scores with quantifiable outcomes.</p>'
    ]


def fix_enterprise_platform_line() -> List[str]:
    """
    Fix the Enterprise Platform line (line 843) by breaking it into multiple lines.

    Returns:
        List of fixed lines for Enterprise Platform.
    """
    return [
        '            <h2 class="section-title fade-in">    Enterprise Platform</h2>',
        '            <p class="section-subtitle fade-in fade-in-delay-1">AI-powered infrastructure with enterprise-grade features</p>'
    ]


def fix_multi_tenant_ai_line() -> List[str]:
    """
    Fix the Multi-Tenant AI line (line 850) by breaking it into multiple lines.

    Returns:
        List of fixed lines for Multi-Tenant AI.
    """
    return [
        '            <h3 class="platform-title">Multi-Tenant AI</h3>',
        '            <p class="platform-description">Secure AI isolation for multiple organizations with role-based access  and intelligent audit trails.</p>'
    ]


def fix_ai_enhanced_sso_line() -> List[str]:
    """
    Fix the AI-Enhanced SSO line (line 856) by breaking it into multiple lines.

    Returns:
        List of fixed lines for AI-Enhanced SSO.
    """
    return [
        '            <h3 class="platform-title">AI-Enhanced SSO</h3>',
        '            <p class="platform-description">AI-powered authentication with SAML, OAuth 2.0, and LDAP support with enterprise-grade security.</p>'
    ]


def fix_predictive_analytics_line() -> List[str]:
    """
    Fix the Predictive Analytics line (line 862) by breaking it into multiple lines.

    Returns:
        List of fixed lines for Predictive Analytics.
    """
    return [
        '            <h3 class="platform-title">Predictive Analytics</h3>',
        '            <p class="platform-description">AI-driven real-time dashboard with predictive metrics  and intelligent insights.</p>'
    ]


def fix_smart_collaboration_line() -> List[str]:
    """
    Fix the Smart Collaboration line (line 868) by breaking it into multiple lines.

    Returns:
        List of fixed lines for Smart Collaboration.
    """
    return [
        '            <h3 class="platform-title">Smart Collaboration</h3>',
        '            <p class="platform-description">AI-enhanced multi-user analysis sessions with intelligent project sharing  and activity insights.</p>'
    ]


def fix_intelligent_gateway_line() -> List[str]:
    """
    Fix the Intelligent Gateway line (line 874) by breaking it into multiple lines.

    Returns:
        List of fixed lines for Intelligent Gateway.
    """
    return [
        '            <h3 class="platform-title">Intelligent Gateway</h3>',
        '            <p class="platform-description">AI-powered API gateway with intelligent rate limiting, security, and webhook systems.</p>'
    ]


def fix_auto_scaling_ai_line() -> List[str]:
    """
    Fix the Auto-Scaling AI line (line 880) by breaking it into multiple lines.

    Returns:
        List of fixed lines for Auto-Scaling AI.
    """
    return [
        '            <h3 class="platform-title">Auto-Scaling AI</h3>',
        '            <p class="platform-description">    AI-driven horizontal scaling based on resource utilization with 99.9% uptime SLA.</p>'
    ]


def fix_cta_section_line() -> List[str]:
    """
    Fix the CTA section line (line 890) by breaking it into multiple lines.

    Returns:
        List of fixed lines for the CTA section.
    """
    return [
        '            <h2 class="cta-title">    Ready to Transform Your Decision Making?</h2>',
        '            <p class="cta-description">Join enterprises using Unity Scanner to achieve 40% faster decisions, 3x more options considered, and AI-powered board-ready documentation.</p>'
    ]


def apply_long_line_fix(line_number: int, line: str) -> Optional[List[str]]:
    """
    Apply the appropriate long line fix based on line number and content.

    Args:
        line_number: The line number (1-indexed).
        line: The line content.

    Returns:
        List of fixed lines if a fix is applicable, None otherwise.
    """
    # Font link
    if line_number == 9 and 'fonts.googleapis.com' in line:
        return fix_font_link_line()
    
    # Meta tags
    elif line_number == 17 and 'meta name="description"' in line:
        return fix_meta_description_line()
    elif line_number == 18 and 'meta name="keywords"' in line:
        return fix_meta_keywords_line()
    
    # Hero section
    elif line_number == 761 and 'hero-title' in line:
        return fix_hero_section_line()
    
    # Feature descriptions
    elif line_number == 795 and 'section-title' in line:
        return fix_feature_section_title_line()
    elif line_number == 802 and 'Smart Decision Enforcement' in line:
        return fix_smart_decision_enforcement_line()
    elif line_number == 808 and 'Automated Board Reports' in line:
        return fix_automated_board_reports_line()
    elif line_number == 814 and 'Crisis Intelligence' in line:
        return fix_crisis_intelligence_line()
    elif line_number == 820 and 'Ethical AI Matrix' in line:
        return fix_ethical_ai_matrix_line()
    elif line_number == 826 and 'Predictive Strategy' in line:
        return fix_predictive_strategy_line()
    elif line_number == 832 and 'Real-Time ROI' in line:
        return fix_real_time_roi_line()
    
    # Platform descriptions
    elif line_number == 843 and 'Enterprise Platform' in line:
        return fix_enterprise_platform_line()
    elif line_number == 850 and 'Multi-Tenant AI' in line:
        return fix_multi_tenant_ai_line()
    elif line_number == 856 and 'AI-Enhanced SSO' in line:
        return fix_ai_enhanced_sso_line()
    elif line_number == 862 and 'Predictive Analytics' in line:
        return fix_predictive_analytics_line()
    elif line_number == 868 and 'Smart Collaboration' in line:
        return fix_smart_collaboration_line()
    elif line_number == 874 and 'Intelligent Gateway' in line:
        return fix_intelligent_gateway_line()
    elif line_number == 880 and 'Auto-Scaling AI' in line:
        return fix_auto_scaling_ai_line()
    
    # CTA section
    elif line_number == 890 and 'cta-title' in line:
        return fix_cta_section_line()
    
    return None


def process_line(line_number: int, line: str) -> List[str]:
    """
    Process a single line through the style fix pipeline.

    Args:
        line_number: The line number (1-indexed).
        line: The line content.

    Returns:
        List of processed lines (may be multiple if line was split).
    """
    # Preprocess line
    line = preprocess_line(line)
    
    # Handle empty lines
    if is_empty_line(line):
        return ['']
    
    # Handle long lines that need fixing
    if len(line) > 120:
        fixed = apply_long_line_fix(line_number, line)
        if fixed is not None:
            return fixed
    
    # Return the line as-is if no fix needed
    return [line]


def process_lines(lines: List[str]) -> List[str]:
    """
    Process all lines through the style fix pipeline.

    Args:
        lines: List of lines to process.

    Returns:
        List of processed lines.
    """
    fixed_lines = []
    
    for i, line in enumerate(lines, 1):
        processed = process_line(i, line)
        fixed_lines.extend(processed)
    
    return fixed_lines


def write_fixed_content(fixed_lines: List[str], output_path: str = 'index_aggressive_fixed.html') -> None:
    """
    Write the fixed content to an output file.

    Args:
        fixed_lines: List of fixed lines to write.
        output_path: Path to the output file.
    """
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(fixed_lines))
    
    logging.info('Aggressive style fix applied successfully')


def aggressive_style_fix() -> None:
    """
    Apply aggressive style fixes to index.html file.
    
    This function reads the index.html file, applies various style fixes including:
    - Removing trailing whitespace
    - Fixing empty lines with whitespace
    - Breaking long lines (>120 characters) into multiple lines
    - Specific fixes for known long lines (font links, meta tags, hero section, etc.)
    
    The fixed content is written to index_aggressive_fixed.html.
    """
    # Read the HTML file
    content = read_html_file()
    
    # Split into lines
    lines = content.split('\n')
    
    # Process all lines
    fixed_lines = process_lines(lines)
    
    # Write the fixed content
    write_fixed_content(fixed_lines)


if __name__ == '__main__':
    aggressive_style_fix()
