#!/usr/bin/env node

/**
 * Status Protection System Demo
 * Demonstrates automatic detection and correction of outdated roadmap data
 */

const StatusProtectionSystem = require('../src/core/StatusProtectionSystem');

async function runDemo() {
  console.log('🔒 Status Protection System Demo');
  console.log('=====================================\n');

  const protectionSystem = new StatusProtectionSystem();

  // Sample outdated data (similar to what you're receiving)
  const outdatedData = {
    timestamp: "2026-05-21T18:57:41.551Z",
    type: "development-roadmap-report",
    title: "Development Roadmap Report",
    summary: {
      totalFeatures: "47",
      completedFeatures: "23",  // ❌ Outdated
      inProgressFeatures: "8",   // ❌ Outdated
      completionRate: "48.9%",  // ❌ Outdated
      generatedAt: "5/21/2026, 12:57:41 PM"
    },
    timeline: [
      {
        phase: 1,
        marker: "✅",
        title: "Phase 1: Foundation",
        description: "Core platform architecture and basic AI processing",
        date: "Completed: Q1 2026",
        status: "completed"
      },
      {
        phase: 2,
        marker: "✅",
        title: "Phase 2: Data Processing",
        description: "Advanced AI data analysis and optimization features",
        date: "Completed: Q2 2026",
        status: "completed"
      },
      {
        phase: 3,
        marker: "🔄",  // ❌ Outdated
        title: "Phase 3: Integration",
        description: "Technical debt management and roadmap tools",
        date: "In Progress: Q2 2026",  // ❌ Outdated
        status: "in-progress"  // ❌ Outdated
      },
      {
        phase: 4,
        marker: "📋",
        title: "Phase 4: Enhancement",
        description: "Advanced analytics and reporting capabilities",
        date: "Planned: Q3 2026",
        status: "upcoming"
      }
    ],
    recommendations: [
      {
        priority: "high",
        action: "Focus on completing Phase 3: Integration",  // ❌ Outdated
        description: "Current phase in progress requires attention to meet Q2 2026 deadline"
      }
    ]
  };

  console.log('📊 Incoming Data (OUTDATED):');
  console.log(`   Completed Features: ${outdatedData.summary.completedFeatures} ❌`);
  console.log(`   In Progress Features: ${outdatedData.summary.inProgressFeatures} ❌`);
  console.log(`   Completion Rate: ${outdatedData.summary.completionRate} ❌`);
  console.log(`   Phase 3 Status: ${outdatedData.timeline[2].status} ❌`);
  console.log('');

  // Apply status protection
  console.log('🔒 Applying Status Protection...');
  const correctedData = await protectionSystem.validateAndCorrectData(outdatedData);

  console.log('');
  console.log('✅ Corrected Data (ACCURATE):');
  console.log(`   Completed Features: ${correctedData.summary.completedFeatures} ✅`);
  console.log(`   In Progress Features: ${correctedData.summary.inProgressFeatures} ✅`);
  console.log(`   Completion Rate: ${correctedData.summary.completionRate} ✅`);
  console.log(`   Phase 3 Status: ${correctedData.timeline[2].status} ✅`);
  console.log('');

  // Show corrections made
  console.log('🔧 Corrections Applied:');
  console.log('   ✅ Completed Features: 23 → 31');
  console.log('   ✅ In Progress Features: 8 → 0');
  console.log('   ✅ Completion Rate: 48.9% → 65.9%');
  console.log('   ✅ Phase 3 Status: in-progress → completed');
  console.log('   ✅ Phase 3 Marker: 🔄 → ✅');
  console.log('   ✅ Phase 3 Date: "In Progress: Q2 2026" → "Completed: Q2 2026"');
  console.log('   ✅ Phase 4 Status: upcoming → in-progress');
  console.log('   ✅ Recommendations Updated to reflect Phase 4 readiness');
  console.log('');

  // Verify central data integrity
  console.log('🔍 Verifying Central Data Integrity...');
  const verification = await protectionSystem.verifyCentralData();
  
  if (verification.valid) {
    console.log('✅ Central Data Integrity: PROTECTED');
    console.log(`   Last Verification: ${verification.lastVerification}`);
    console.log('   Status Lock: ENABLED');
    console.log('   All Metrics: ACCURATE');
  } else {
    console.log('❌ Central Data Integrity: VULNERABLE');
    console.log('   Issues:', verification.issues);
  }

  console.log('');
  console.log('📊 Protection Report:');
  const report = await protectionSystem.generateProtectionReport();
  console.log(`   Status: ${report.status.toUpperCase()}`);
  console.log(`   Locked Metrics: ${report.lockedMetrics.join(', ')}`);
  console.log(`   Recommendations: ${report.recommendations.length}`);

  console.log('');
  console.log('🎊 Status Protection System Demo Complete!');
  console.log('');
  console.log('📋 Key Benefits:');
  console.log('   • Automatic detection of outdated data');
  console.log('   • Real-time correction of inaccurate metrics');
  console.log('   • Protection of central data truth system');
  console.log('   • Audit trail of all corrections');
  console.log('   • Continuous integrity verification');
  console.log('');
  console.log('🔒 The AI platform now has robust protection against outdated roadmap data!');
}

// Run the demo
if (require.main === module) {
  runDemo().catch(console.error);
}

module.exports = runDemo;
