/**
 * Phase Registry — shared helper for roadmap phase metrics.
 * Reduces duplication in generateRoadmap by centralizing progress/status/severity logic.
 */

export function computePhaseMetrics({ issues=0, weight=1, thresholds={high:5,critical:10}, maxPenalty=50 }) {
  const progress = issues === 0 ? 100 : Math.max(5, Math.min(100, 100 - issues * weight));
  const status = progress >= 95 ? 'completed' : (progress > 0 ? 'in-progress' : 'pending');
  const severity = issues >= thresholds.critical ? 'critical'
                 : issues >= thresholds.high ? 'high' : 'low';
  return { progress, status, severity };
}

export const PHASE_REGISTRY = [
  { id:'security', title:'Security Hardening', effort:'1–2 days', thresholds:{high:1,critical:1},
    build(report){
      const src=report.sourceReport||report;
      const credFindings=report.gate?.credentialHits??(src.gate?.credentialHits);
      const leakFindings=report.gate?.productionLeakCount??(src.gate?.productionLeakCount);
      const totalIssues=(credFindings||0)+(leakFindings||0);
      const m=computePhaseMetrics({issues:totalIssues,weight:15,thresholds:{high:1,critical:1}});
      return {...m,description:totalIssues===0?'No security issues detected — credentials && secrets verified.':`Address ${credFindings||0} credential and ${leakFindings||0} production leak finding(s).`};
    }
  },
  { id:'integrity', title:'Data Integrity', effort:'2–4 days', thresholds:{high:3,critical:5},
    build(report){
      const src=report.sourceReport||report;
      const invalidJson=report.invalidJsonFiles??src.dataQuality?.invalidJsonFileCount;
      const emptyFiles=report.emptyJsonFiles??src.dataQuality?.emptyFileCount;
      const schemaComp=report.schemaCompliance??src.schemaCompliance;
      const issues=(invalidJson||0)+(emptyFiles||0);
      const m=computePhaseMetrics({issues,weight:10,thresholds:{high:3,critical:5}});
      const allClean=(invalidJson===0||invalidJson==null)&&(emptyFiles===0||emptyFiles==null)&&(schemaComp===100||schemaComp==null);
      return {...m,severity:allClean?'low':m.severity,status:allClean?'completed':m.status,progress:allClean?100:(schemaComp!=null?Math.round(schemaComp):m.progress),description:allClean?'Data integrity verified — no structural issues detected.':`Resolve structural issues: ${invalidJson||0} invalid JSON, ${emptyFiles||0} empty files.`};
    }
  },
  { id:'consistency', title:'Consistency & Deduplication', effort:'3–5 days', thresholds:{high:5,critical:10},
    build(report){
      const src=report.sourceReport||report;
      const dupes=report.duplicateGroups??src.consolidation?.duplicateGroups;
      const consistency=report.consistencyScore??src.consistencyScore;
      const issues=dupes||0;
      const m=computePhaseMetrics({issues,weight:5,thresholds:{high:5,critical:10}});
      const autoComplete=(dupes===0||dupes==null)&&(consistency===100||consistency==null);
      return {...m,severity:autoComplete?'low':m.severity,status:autoComplete?'completed':m.status,progress:autoComplete?100:Math.round(((consistency||0)+(dupes===0?100:50))/2),description:autoComplete?'Consistency verified — structural duplicates only.':`Eliminate redundancy: ${dupes||0} duplicate group(s).`};
    }
  },
  { id:'cleanup', title:'Cleanup & Hygiene', effort:'1–2 days', thresholds:{high:20,critical:50},
    build(report){
      const src=report.sourceReport||report;
      const dc=report.cleanup?.debugArtifactCount||0;
      const bloatCount=report.cleanup?.bloatArtifactCount||0;
      const issues=dc+bloatCount;
      const m=computePhaseMetrics({issues,weight:1,thresholds:{high:20,critical:50}});
      return {...m,description:issues===0?'No debug artifacts or bloat detected — codebase is clean.':`${dc} debug artifact(s)${bloatCount>0?` + ${bloatCount} bloat file(s)`:''} detected.`};
    }
  },
  { id:'compliance', title:'Governance & Compliance', effort:'2–3 days', thresholds:{high:1,critical:1},
    build(report){
      const src=report.sourceReport||report;
      const comp=src.compliance||{};
      const licenseCount=comp.licenseCount!=null?Number(comp.licenseCount):0;
      const securityCount=comp.securityCount!=null?Number(comp.securityCount):0;
      const govScore=comp.governanceScore!=null?Number(comp.governanceScore):null;
      const standardGovFiles=['LICENSE','SECURITY.md','CODE_OF_CONDUCT.md','CONTRIBUTING.md','CHANGELOG.md','PRIVACY.md','NOTICE'];
      const foundGovCount=(licenseCount||0)+(securityCount||0);
      const progress=govScore!=null?Math.min(100,Math.round((govScore/standardGovFiles.length)*100)):Math.min(100,Math.round((foundGovCount/standardGovFiles.length)*100));
      const status=progress>=95?'completed':(progress>0?'in-progress':'pending');
      return {progress,status,severity:'low',description:`${licenseCount} license file(s), ${securityCount} security file(s).${govScore!=null?' Governance score: '+govScore+'.':''}`};
    }
  },
  { id:'euaiact', title:'EU AI Act Compliance', effort:'5–10 days', thresholds:{high:1,critical:1},
    build(report){
      const src=report.sourceReport||report;
      const s=src.euAiActSummary||{},hr=Number(s.highRiskIndicators)||0,tg=Number(s.transparencyGaps)||0,ai=Number(s.aiSystemIndicators)||0,art=Number(s.documentationArtifacts)||0;
      const clean=hr===0&&tg===0&&ai===0;
      const artifactBonus=art>0?Math.min(30,art*6):0;
      const penalty=hr*15+tg*10+ai*5;
      const progress=clean?Math.min(100,75+artifactBonus):Math.max(10,Math.min(100,50+artifactBonus-penalty));
      const status=progress>=95?'completed':(progress>0?'in-progress':'pending');
      const severity=hr>0?'critical':(ai>0?'high':'low');
      return {progress,status,severity,description:clean?'No AI system indicators detected — EU AI Act compliance verified.':`Regulatory readiness: ${ai} AI indicators, ${hr} high-risk, ${tg} transparency gaps, ${art} artifacts.`};
    }
  },
  { id:'mockdata', title:'Mock Data Review', effort:'1 day', thresholds:{high:1,critical:1},
    build(report){
      const src=report.sourceReport||report;
      const mockCats=src.mockDataCategories||[];
      const mockTotal=src.mockSampleFiles??mockCats.reduce((a,c)=>a+(c.fileCount||0),0);
      const mockAutoComplete=mockTotal===0;
      return {progress:mockAutoComplete?100:Math.max(5,Math.min(100,Math.round(100-mockTotal*0.5))),status:mockAutoComplete?'completed':'pending',severity:'low',effort:mockAutoComplete?'None':'1 day',description:mockAutoComplete?'No mock data issues — fixtures verified or none detected.':`${mockTotal} mock/fixture file(s) detected — verify excluded from production.`};
    }
  },
  { id:'npmaudit', title:'npm Audit', effort:'1 day', thresholds:{high:1,critical:1},
    build(report){
      const npm=report.npmAudit||{};
      const pkgCount=npm.packageJsonCount!=null?Number(npm.packageJsonCount):0;
      const depCount=npm.dependencyCount!=null?Number(npm.dependencyCount):0;
      const outdatedCount=npm.outdatedCount!=null?Number(npm.outdatedCount):0;
      const missingLockfiles=npm.missingLockfiles!=null?Number(npm.missingLockfiles):0;
      const issues=(outdatedCount>0?1:0)+(missingLockfiles>0?1:0);
      const m=computePhaseMetrics({issues,weight:30,thresholds:{high:1,critical:1}});
      return {...m,description:pkgCount===0&&depCount===0?'No package.json detected — verify project has dependencies.':`${pkgCount} package.json file(s), ${depCount} total dependencies${missingLockfiles>0?', '+missingLockfiles+' missing lockfile(s)':''}${outdatedCount>0?', '+outdatedCount+' outdated':''}.`};
    }
  },
  { id:'optimization', title:'Quality Optimization', effort:'Ongoing', thresholds:{high:10,critical:20},
    build(report){
      const src=report.sourceReport||report;
      const qs=report.qualityScore??src.qualityScore;
      const todoMarkers=report.todoMarkers??src.todoMarkers;
      const issues=(todoMarkers||0);
      const m=computePhaseMetrics({issues,weight:2,thresholds:{high:10,critical:20}});
      const penalty=Math.min(20,issues*2);
      const progress=Math.max(0,Math.min(100,Math.round(qs||0)-penalty));
      const status=progress>=95?'completed':(progress>0?'in-progress':'pending');
      const severity=qs<70?'high':'low';
      const desc=qs>=95?`Maintain quality score at ${qs}/100 (currently above 95+).`:`Drive quality score from ${qs||0}/100 toward 95+.`;
      return {progress,status,severity,description:desc+`${issues>0?' '+issues+' TODO marker(s).':''}`};
    }
  },
  { id:'junkfiles', title:'Junk & Temporary Files', effort:'1 day', thresholds:{high:5,critical:10},
    build(report){
      const src=report.sourceReport||report;
      const jCount=report.junkFiles?.count??0;
      const m=computePhaseMetrics({issues:jCount,weight:2,thresholds:{high:5,critical:10}});
      return {...m,description:jCount===0?'No junk or temporary files detected.':`${jCount} junk / temporary file(s) detected.`};
    }
  },
  { id:'buildreadiness', title:'Build Readiness', effort:'2–3 days', thresholds:{high:3,critical:5},
    build(report){
      const src=report.sourceReport||report;
      const brScore=src.buildReadiness?.score!=null?Number(src.buildReadiness.score):null;
      const issues=src.buildReadiness?.issues?.length||0;
      const progress=brScore!=null?Math.min(100,Math.round(brScore)):(issues===0?100:50);
      const status=(brScore!=null&&brScore>=80)||issues===0?'completed':'pending';
      const severity=issues>0?'medium':'low';
      return {progress,status,severity,description:brScore!=null?`Build readiness: ${brScore}%.`:(issues===0?'Build readiness verified — no issues detected.':`Build readiness — ${issues} issue(s) detected.`)};
    }
  },
  { id:'vulns', title:'Dependency Vulnerability Audit', effort:'1–3 days', thresholds:{high:1,critical:1},
    build(report){
      const src=report.sourceReport||report;
      const vCount=src.dependencyAudit?.vulnerabilityCount??0;
      const m=computePhaseMetrics({issues:vCount,weight:15,thresholds:{high:1,critical:1}});
      return {...m,description:vCount===0?'No vulnerable dependencies detected.':`${vCount} vulnerable dependency(ies) detected.`};
    }
  }
];

// Expose for browser (global) and Node (module)
if(typeof window!=='undefined'){window.PHASE_REGISTRY=PHASE_REGISTRY;window.computePhaseMetrics=computePhaseMetrics;}
if(typeof module!=='undefined'&&module.exports){module.exports={PHASE_REGISTRY,computePhaseMetrics};}
