const fs = require('fs');
const s = fs.readFileSync('c:/Users/Trevor/CascadeProjects/.simplebeacon/codemap.html', 'utf8');

// Find all script tags
const scriptTags = [];
let pos = 0;
while (true) {
  const start = s.indexOf('<script', pos);
  if (start === -1) break;
  const end = s.indexOf('</script>', start);
  if (end === -1) {
    console.log('Unclosed script tag at position', start);
    break;
  }
  scriptTags.push({
    start,
    end: end + 9,
    content: s.substring(start, end + 9),
    isJson: s.substring(start, start + 30).includes('application/json')
  });
  pos = end + 9;
}

console.log('Found', scriptTags.length, 'script tags');

// Check if any JSON script tag contains </script> inside its content
let foundIssue = false;
scriptTags.forEach((tag, i) => {
  if (tag.isJson) {
    const innerStart = tag.content.indexOf('>');
    const innerEnd = tag.content.lastIndexOf('</script>');
    const innerContent = tag.content.substring(innerStart + 1, innerEnd);
    if (innerContent.includes('</script>')) {
      console.log('PROBLEM: Script tag', i, 'contains </script> inside its content!');
      foundIssue = true;
    }
  }
});

if (!foundIssue) {
  console.log('No </script> inside JSON script tags');
}

// Check for any raw </script> in the main script content
const mainScriptIdx = s.search(/<script>\s*const/);
if (mainScriptIdx !== -1) {
  const mainScriptEnd = s.indexOf('</script>', mainScriptIdx);
  const mainScriptContent = s.substring(mainScriptIdx + 8, mainScriptEnd);
  console.log('Main script length:', mainScriptContent.length);
  
  // Try to parse it
  try {
    new Function(mainScriptContent);
    console.log('Main script syntax: OK');
  } catch (e) {
    console.log('Main script syntax ERROR:', e.message);
  }
} else {
  console.log('Main script not found');
}
