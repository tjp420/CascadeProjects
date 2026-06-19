# SimpleBeacon Model Card

## Overview
SimpleBeacon is a static code analysis and compliance scanning platform. This document covers model architecture, intended use, performance benchmarks, ethical considerations, and maintenance schedule.

## Contents
- [Model Information](#model-information)
- [Intended Use](#intended-use)
- [Model Architecture](#model-architecture)
- [Training Data](#training-data)
- [Performance](#performance)
- [Ethical Considerations](#ethical-considerations)
- [Safety & Security](#safety--security)
- [Maintenance](#maintenance)
- [Contact](#contact)

## Model Information

**Model Type**: Static Code Analysis & Compliance Scanning Platform  
**Version**: 1.0.0  
**Last Updated**: 2026-06-14  
**Developer**: SimpleBeacon Infrastructure Team

## Intended Use

### Primary Use Case
SimpleBeacon is a developer tool designed to:
- Scan code repositories for security vulnerabilities
- Detect credential leaks and production data exposure
- Identify AI-generated code patterns and fiction KPIs
- Provide compliance reports for EU AI Act readiness
- Generate audit trails for code quality and governance

### Intended Users
- Software developers and engineering teams
- DevOps and security professionals
- Compliance officers and auditors
- Agency development teams

### Out-of-Scope Uses
- Making automated decisions about individuals
- Evaluating individuals for employment or services
- Controlling safety-critical infrastructure
- Medical diagnosis or treatment decisions

### Prohibited Practices (EU AI Act Art. 5)
SimpleBeacon **does not** engage in any of the prohibited AI practices listed in Article 5(1) of Regulation (EU) 2024/1689:
- No social scoring or evaluation of natural persons based on social behavior or personal characteristics
- No biometric identification or categorization in publicly accessible spaces
- No emotion recognition in workplace or education settings
- No real-time remote biometric identification by law enforcement
- No exploitation of vulnerabilities of specific groups
- No subliminal techniques to distort behavior causing physical or psychological harm
- No systems that deploy scoring or rating of natural persons

## Model Architecture

### Components
1. **Static Analysis Engine**: Pattern-based code scanning (deterministic, no ML)
2. **Credential Scanner**: Regex-based secret detection
3. **Production Leak Detector**: Path analysis for sample data references
4. **AI Fiction Detector**: Pattern matching for AI-generated KPIs
5. **Compliance Reporter**: EU AI Act checklist automation
6. **Anonymized Export Engine**: Privacy-blind tokenization — strips all source code before transmission
7. **Local Remediation Agent**: Ollama-based `--fix` with zero cloud by default
8. **MCP Rule Catalog**: Exposes deterministic rule schemas to Cursor/Claude via Model Context Protocol

### Data Processing
- All processing occurs locally on user machines
- No code transmission to external servers by default
- Optional cloud features require explicit user consent

## Training Data

### Pattern Sources
- Common credential patterns (API keys, tokens, secrets)
- Known production leak patterns (sample JSON references)
- AI-generated code patterns (fiction KPIs, hallucinated metrics)
- EU AI Act compliance requirements

### Data Sources
- Public security advisories
- Industry best practices
- Regulatory documentation
- Open-source vulnerability databases

## Performance

### Accuracy Metrics
- False Positive Rate: < 5% (measured 2026-06-10 benchmark suite, n=1,247 files; configurable via ignore patterns)
- False Negative Rate: < 2% for critical patterns (measured on seeded credential fixture set, n=482 patterns)
- Scan Speed: ~500-1000 files/second (measured on NVMe SSD, 4-core CPU; varies by file size)

### Limitations
- Pattern-based detection may miss novel vulnerabilities
- Static analysis cannot detect runtime behavior
- Requires regular pattern updates for new threats
- May flag legitimate test/fixture code (configurable)

## Ethical Considerations

### Transparency
- All scan results are explainable and reviewable
- Users can inspect and modify scan rules
- Clear documentation of scan scope and limitations

### Fairness
- No bias in code analysis - treats all code equally
- Does not evaluate or classify individuals
- No demographic or personal data processing

### Accountability
- Developers maintain full control over code changes
- Platform provides recommendations, not mandates
- Human review required for all significant findings

## Safety & Security

### Data Protection
- Local-only scanning by default
- No code storage on external servers
- Optional encryption for cloud features
- GDPR-compliant data handling

### Vulnerability Disclosure
- Security issues reported via responsible disclosure
- Public CVEs tracked and addressed
- Regular security audits

## Maintenance

### Update Schedule
- Pattern updates: Monthly or as needed
- Security patches: Within 7 days of CVE disclosure
- Feature updates: Quarterly release cycle

### Version Control
- Git-based versioning
- Semantic versioning (MAJOR.MINOR.PATCH)
- Backward compatibility maintained for minor versions

## Contact

**Support**: support@simplebeacon.dev  
**Security**: security@simplebeacon.dev  
**Documentation**: https://docs.simplebeacon.dev  
