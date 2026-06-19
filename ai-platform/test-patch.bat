@echo off
cd /d C:\Users\Trevor\CascadeProjects\ai-platform
node -e "
const http = require('http');

const req = http.get('http://localhost:55000/api/simplebeacon/report', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const report = JSON.parse(data);
      const phases = report.remediationPhases || [];
      
      const getPhase = (id) => phases.find(p => p.id === id);
      
      const compliance = getPhase('compliance');
      const euaiact = getPhase('euaiact');
      const optimization = getPhase('optimization');
      
      console.log('');
      console.log('=== Health Report Phase Verification ===');
      console.log('');
      
      console.log('Phase 3: Governance & Compliance');
      console.log('  Description:', compliance ? compliance.description : 'NOT FOUND');
      console.log('  Status:', compliance && compliance.description.includes('Governance files detected') ? 'FIXED' : 'BUG');
      console.log('');
      
      console.log('Phase 4: EU AI Act Compliance');
      console.log('  Description:', euaiact ? euaiact.description : 'NOT FOUND');
      console.log('  Status:', euaiact && euaiact.description.includes('2 AI indicator(s)') ? 'FIXED' : 'BUG');
      console.log('');
      
      console.log('Phase 5: Quality Optimization');
      console.log('  Description:', optimization ? optimization.description : 'NOT FOUND');
      console.log('  Status:', optimization && optimization.description.includes('Maintain quality score') ? 'FIXED' : 'BUG');
      console.log('');
      
    } catch (e) {
      console.error('Error parsing response:', e.message);
      console.error('Raw data:', data.slice(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error('Request failed:', e.message);
  console.error('Is the server running on port 55000?');
});

req.setTimeout(5000, () => {
  console.error('Request timed out');
  req.destroy();
});
"
