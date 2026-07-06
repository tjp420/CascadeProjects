const h=require('http');
h.get('http://127.0.0.1:8085',r=>{
  let d='';
  r.on('data',c=>d+=c);
  r.on('end',()=>{
    const dataPathOK=d.includes('data-path=".github/CODEOWNERS"');
    const clickSplitOK=d.includes("split(' \u2014 ')[0]");
    const dataPathOnNodeOK=d.includes('data-path=') && d.includes('data-in-graph=');
    console.log('data-path on CODEOWNERS:',dataPathOK);
    console.log('Click handler splits title:',clickSplitOK);
    console.log('Nodes have data-path:',dataPathOnNodeOK);
    console.log('All checks pass:',dataPathOK&&clickSplitOK&&dataPathOnNodeOK);
  });
}).on('error',e=>console.log('ERR',e.message));
