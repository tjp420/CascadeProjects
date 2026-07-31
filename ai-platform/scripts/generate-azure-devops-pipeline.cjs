#!/usr/bin/env node
'use strict';

/**
 * Azure DevOps Pipeline Template Generator
 *
 * Generates production-ready Azure DevOps pipeline YAML files for
 * enterprise SimpleBeacon clients. Supports multiple pipeline modes:
 *
 *   - compliance:    Full compliance scan + PDF report + quality gate
 *   - continuous:    PR-triggered continuous compliance on every change
 *   - scheduled:     Nightly compliance audit with trend tracking
 *   - onboarding:    First-run pipeline for new enterprise clients
 *
 * Usage:
 *   node generate-azure-devops-pipeline.js --org-id <id> --api-key <key> --mode compliance
 *   node generate-azure-devops-pipeline.js --org-id <id> --api-key <key> --mode continuous --output pipeline.yml
 */

const fs = require('fs');
const path = require('path');

// ── Pipeline Templates ──────────────────────────────────────────────────────

function generateCompliancePipeline(opts) {
  const { orgId, apiKey, projectPath, failOn = 'high' } = opts;
  const scanPath = projectPath || '$(Build.SourcesDirectory)';
  const generated = new Date().toISOString();

  return `# SimpleBeacon Enterprise — Azure DevOps Compliance Pipeline
# Organization: ${orgId}
# Mode: Compliance (full scan + PDF + quality gate)
# Generated: ${generated}
#
# Setup:
#   1. Add SIMPLEBEACON_API_KEY as a secret pipeline variable
#   2. Set the value to your org API key (starts with "ent_")
#   3. Save and run

trigger:
  branches:
    include:
      - main
      - develop
      - release/*

pool:
  vmImage: 'ubuntu-latest'

variables:
  SIMPLEBEACON_API_KEY: $(SIMPLEBEACON_API_KEY)
  SCAN_PATH: '${scanPath}'
  SCAN_GATE: 'true'
  FAIL_ON: '${failOn}'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '22.x'
    displayName: 'Install Node.js 22'

  - script: |
      npm install -g simplebeacon@latest
    displayName: 'Install SimpleBeacon CLI'

  - script: |
      echo "##[group]SimpleBeacon Compliance Scan"
      simplebeacon scan \\
        --path "$(SCAN_PATH)" \\
        --gate \\
        --fail-on "$(FAIL_ON)" \\
        --format json \\
        --output "$(Build.ArtifactStagingDirectory)/simplebeacon-report.json" \\
        --api-key "$(SIMPLEBEACON_API_KEY)"
      echo "##[endgroup]"
    displayName: 'Run SimpleBeacon Compliance Scan'
    continueOnError: false

  - task: PublishBuildArtifacts@1
    inputs:
      PathtoPublish: '$(Build.ArtifactStagingDirectory)/simplebeacon-report.json'
      ArtifactName: 'SimpleBeaconReport'
      publishLocation: 'Container'
    displayName: 'Publish Scan Report Artifact'

  - script: |
      echo "##[group]Executive PDF Report Generation"
      simplebeacon report \\
        --input "$(Build.ArtifactStagingDirectory)/simplebeacon-report.json" \\
        --format pdf \\
        --output "$(Build.ArtifactStagingDirectory)/simplebeacon-executive-report.pdf" \\
        --api-key "$(SIMPLEBEACON_API_KEY)"
      echo "##[endgroup]"
    condition: always()
    displayName: 'Generate Executive PDF Report'
    continueOnError: true

  - task: PublishBuildArtifacts@1
    inputs:
      PathtoPublish: '$(Build.ArtifactStagingDirectory)/simplebeacon-executive-report.pdf'
      ArtifactName: 'SimpleBeaconExecutiveReport'
      publishLocation: 'Container'
    condition: always()
    displayName: 'Publish Executive PDF Report'

  - script: |
      echo "##[group]Compliance Summary"
      simplebeacon summary \\
        --input "$(Build.ArtifactStagingDirectory)/simplebeacon-report.json" \\
        --format markdown
      echo "##[endgroup]"
    condition: always()
    displayName: 'Generate Compliance Summary'
    continueOnError: true

  - script: |
      echo "##vso[task.setvariable variable=SIMPLEBEACON_SCAN_COMPLETE;isOutput=true]true"
    displayName: 'Mark Scan Complete'
    name: scanResult
`;
}

function generateContinuousPipeline(opts) {
  const { orgId, apiKey, projectPath, failOn = 'high' } = opts;
  const scanPath = projectPath || '$(Build.SourcesDirectory)';
  const generated = new Date().toISOString();

  return `# SimpleBeacon Enterprise — Azure DevOps Continuous Compliance Pipeline
# Organization: ${orgId}
# Mode: Continuous (PR-triggered quality gate)
# Generated: ${generated}
#
# Runs on every pull request to enforce AI compliance quality gates.

trigger: none

pr:
  branches:
    include:
      - main
      - develop
      - release/*

pool:
  vmImage: 'ubuntu-latest'

variables:
  SIMPLEBEACON_API_KEY: $(SIMPLEBEACON_API_KEY)
  SCAN_PATH: '${scanPath}'
  FAIL_ON: '${failOn}'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '22.x'
    displayName: 'Install Node.js 22'

  - script: |
      npm install -g simplebeacon@latest
    displayName: 'Install SimpleBeacon CLI'

  - script: |
      echo "##[group]SimpleBeacon PR Compliance Gate"
      simplebeacon scan \\
        --path "$(SCAN_PATH)" \\
        --gate \\
        --fail-on "$(FAIL_ON)" \\
        --format json \\
        --output "$(Build.ArtifactStagingDirectory)/simplebeacon-pr-report.json" \\
        --api-key "$(SIMPLEBEACON_API_KEY)"
      echo "##[endgroup]"
    displayName: 'Run PR Compliance Scan'
    continueOnError: false

  - script: |
      echo "##[group]PR Compliance Summary"
      simplebeacon summary \\
        --input "$(Build.ArtifactStagingDirectory)/simplebeacon-pr-report.json" \\
        --format markdown
      echo "##[endgroup]"
    condition: always()
    displayName: 'Generate PR Compliance Summary'

  - task: PublishBuildArtifacts@1
    inputs:
      PathtoPublish: '$(Build.ArtifactStagingDirectory)/simplebeacon-pr-report.json'
      ArtifactName: 'SimpleBeaconPRReport'
      publishLocation: 'Container'
    condition: always()
    displayName: 'Publish PR Report Artifact'
`;
}

function generateScheduledPipeline(opts) {
  const { orgId, apiKey, projectPath, failOn = 'high', cron = '0 2 * * *' } = opts;
  const scanPath = projectPath || '$(Build.SourcesDirectory)';
  const generated = new Date().toISOString();

  return `# SimpleBeacon Enterprise — Azure DevOps Scheduled Compliance Audit
# Organization: ${orgId}
# Mode: Scheduled (nightly compliance audit with trend tracking)
# Generated: ${generated}
#
# Runs nightly to track compliance posture over time.

schedules:
  - cron: "${cron}"
    displayName: 'Nightly SimpleBeacon Compliance Audit'
    branches:
      include:
        - main
    always: true

pool:
  vmImage: 'ubuntu-latest'

variables:
  SIMPLEBEACON_API_KEY: $(SIMPLEBEACON_API_KEY)
  SCAN_PATH: '${scanPath}'
  SCAN_DATE: '$(Build.BuildNumber)'
  FAIL_ON: '${failOn}'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '22.x'
    displayName: 'Install Node.js 22'

  - script: |
      npm install -g simplebeacon@latest
    displayName: 'Install SimpleBeacon CLI'

  - script: |
      echo "##[group]Nightly Compliance Scan — $(SCAN_DATE)"
      simplebeacon scan \\
        --path "$(SCAN_PATH)" \\
        --gate \\
        --fail-on "$(FAIL_ON)" \\
        --format json \\
        --output "$(Build.ArtifactStagingDirectory)/simplebeacon-nightly-$(SCAN_DATE).json" \\
        --api-key "$(SIMPLEBEACON_API_KEY)"
      echo "##[endgroup]"
    displayName: 'Run Nightly Compliance Scan'
    continueOnError: true

  - task: PublishBuildArtifacts@1
    inputs:
      PathtoPublish: '$(Build.ArtifactStagingDirectory)/simplebeacon-nightly-$(SCAN_DATE).json'
      ArtifactName: 'SimpleBeaconNightlyReports'
      publishLocation: 'Container'
    condition: always()
    displayName: 'Publish Nightly Report'

  - script: |
      echo "##[group]Executive PDF Report — $(SCAN_DATE)"
      simplebeacon report \\
        --input "$(Build.ArtifactStagingDirectory)/simplebeacon-nightly-$(SCAN_DATE).json" \\
        --format pdf \\
        --output "$(Build.ArtifactStagingDirectory)/simplebeacon-nightly-$(SCAN_DATE).pdf" \\
        --api-key "$(SIMPLEBEACON_API_KEY)"
      echo "##[endgroup]"
    condition: always()
    displayName: 'Generate Nightly Executive PDF'
    continueOnError: true

  - task: PublishBuildArtifacts@1
    inputs:
      PathtoPublish: '$(Build.ArtifactStagingDirectory)/simplebeacon-nightly-$(SCAN_DATE).pdf'
      ArtifactName: 'SimpleBeaconNightlyPDFs'
      publishLocation: 'Container'
    condition: always()
    displayName: 'Publish Nightly PDF'

  - script: |
      echo "##[group]Compliance Trend Summary"
      simplebeacon summary \\
        --input "$(Build.ArtifactStagingDirectory)/simplebeacon-nightly-$(SCAN_DATE).json" \\
        --format markdown
      echo "##[endgroup]"
    condition: always()
    displayName: 'Generate Trend Summary'
    continueOnError: true
`;
}

function generateOnboardingPipeline(opts) {
  const { orgId, apiKey, projectPath } = opts;
  const scanPath = projectPath || '$(Build.SourcesDirectory)';
  const generated = new Date().toISOString();

  return `# SimpleBeacon Enterprise — First-Run Onboarding Pipeline
# Organization: ${orgId}
# Mode: Onboarding (first scan + baseline report)
# Generated: ${generated}
#
# Run this once when onboarding a new enterprise client to establish
# a compliance baseline. The scan results will be saved as build artifacts.

trigger: manual

pool:
  vmImage: 'ubuntu-latest'

variables:
  SIMPLEBEACON_API_KEY: $(SIMPLEBEACON_API_KEY)
  SCAN_PATH: '${scanPath}'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '22.x'
    displayName: 'Install Node.js 22'

  - script: |
      npm install -g simplebeacon@latest
    displayName: 'Install SimpleBeacon CLI'

  - script: |
      echo "##[section]SimpleBeacon Enterprise Onboarding Scan"
      echo "##[group]Organization: ${orgId}"
      echo "##[group]Running baseline compliance scan..."
      simplebeacon scan \\
        --path "$(SCAN_PATH)" \\
        --format json \\
        --output "$(Build.ArtifactStagingDirectory)/baseline-report.json" \\
        --api-key "$(SIMPLEBEACON_API_KEY)"
      echo "##[endgroup]"
    displayName: 'Run Baseline Compliance Scan'
    continueOnError: true

  - task: PublishBuildArtifacts@1
    inputs:
      PathtoPublish: '$(Build.ArtifactStagingDirectory)/baseline-report.json'
      ArtifactName: 'BaselineReport'
      publishLocation: 'Container'
    condition: always()
    displayName: 'Publish Baseline Report'

  - script: |
      echo "##[group]Generate Executive Baseline PDF"
      simplebeacon report \\
        --input "$(Build.ArtifactStagingDirectory)/baseline-report.json" \\
        --format pdf \\
        --output "$(Build.ArtifactStagingDirectory)/baseline-executive-report.pdf" \\
        --api-key "$(SIMPLEBEACON_API_KEY)"
      echo "##[endgroup]"
    condition: always()
    displayName: 'Generate Baseline Executive PDF'
    continueOnError: true

  - task: PublishBuildArtifacts@1
    inputs:
      PathtoPublish: '$(Build.ArtifactStagingDirectory)/baseline-executive-report.pdf'
      ArtifactName: 'BaselineExecutiveReport'
      publishLocation: 'Container'
    condition: always()
    displayName: 'Publish Baseline PDF'

  - script: |
      echo "##[section]Onboarding Complete"
      echo "##[group]Compliance Baseline Summary"
      simplebeacon summary \\
        --input "$(Build.ArtifactStagingDirectory)/baseline-report.json" \\
        --format markdown
      echo "##[endgroup]"
      echo ""
      echo "##[section]Next Steps"
      echo "1. Review the baseline report and executive PDF"
      echo "2. Set up the continuous compliance pipeline for PRs"
      echo "3. Configure the nightly scheduled audit pipeline"
      echo "4. Distribute license tokens to team members"
      echo "5. Configure SSO in the admin dashboard"
    condition: always()
    displayName: 'Onboarding Summary'
    continueOnError: true
`;
}

// ── Pipeline Mode Registry ──────────────────────────────────────────────────

const PIPELINE_MODES = {
  compliance: generateCompliancePipeline,
  continuous: generateContinuousPipeline,
  scheduled: generateScheduledPipeline,
  onboarding: generateOnboardingPipeline,
};

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      args[key] = value;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);

  if (!args.orgId) {
    console.log(`
Usage:
  node generate-azure-devops-pipeline.js --org-id <id> --mode <mode> [options]

Modes:
  compliance   — Full scan + PDF + quality gate (main branch trigger)
  continuous   — PR-triggered quality gate for every pull request
  scheduled    — Nightly compliance audit with trend tracking
  onboarding   — First-run baseline scan for new enterprise clients

Options:
  --org-id <id>          Organization ID (required)
  --api-key <key>        Organization API key (for reference in YAML)
  --mode <mode>          Pipeline mode (default: compliance)
  --project-path <path>  Scan path (default: $(Build.SourcesDirectory))
  --fail-on <level>      Fail threshold: high, medium, low (default: high)
  --cron <expr>          Cron expression for scheduled mode (default: 0 2 * * *)
  --output <file>        Output file path (default: stdout)
`);
    return;
  }

  const mode = args.mode || 'compliance';
  const generator = PIPELINE_MODES[mode];
  if (!generator) {
    console.error(`Unknown mode: ${mode}. Valid modes: ${Object.keys(PIPELINE_MODES).join(', ')}`);
    process.exit(1);
  }

  const yaml = generator({
    orgId: args.orgId,
    apiKey: args.apiKey || '<YOUR_API_KEY>',
    projectPath: args['project-path'],
    failOn: args['fail-on'] || 'high',
    cron: args.cron,
  });

  if (args.output) {
    const dir = path.dirname(args.output);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(args.output, yaml, 'utf8');
    console.log(`Pipeline YAML written to: ${args.output}`);
    console.log(`Mode: ${mode}`);
    console.log(`Organization: ${args.orgId}`);
  } else {
    console.log(yaml);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  generateCompliancePipeline,
  generateContinuousPipeline,
  generateScheduledPipeline,
  generateOnboardingPipeline,
  PIPELINE_MODES,
};
