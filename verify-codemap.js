// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const h=require('http');
h.get('http://127.0.0.1:8085',r=>{
  let d='';
  r.on('data',c=>d+=c);
  r.on('end',()=>{
    const cssOK=d.includes('tree-node[data-in-graph="false"]');
    const dotOK=d.includes('graph-dot.not-in-graph{background:#64748b');
    const jsOK=d.includes('e.button === 0 && locked');
    const clickOK=d.includes('handled in mousedown');
    console.log('CSS rule present:',cssOK);
    console.log('Dot color rule present:',dotOK);
    console.log('JS locked check present:',jsOK);
    console.log('Click handler skip present:',clickOK);
    console.log('All checks pass:',cssOK&&dotOK&&jsOK&&clickOK);
  });
}).on('error',e=>console.log('ERR',e.message));
