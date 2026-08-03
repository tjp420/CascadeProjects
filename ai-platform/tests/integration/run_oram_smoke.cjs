const assert = require('assert');
const PathORAM = require('../../server/lib/oram/path_oram.cjs');

// simple in-memory store that records put operations timing for verification
function createRecordingStore() {
  const map = new Map();
  const puts = [];
  return {
    puts,
    async get(key){
      return map.get(key) || [];
    },
    async put(key, val){
      const start = Date.now();
      // simulate some IO latency
      await new Promise(r => setTimeout(r, 20));
      map.set(key, val);
      const end = Date.now();
      puts.push({ key, start, end });
    }
  };
}

(async function main(){
  try {
    const store = createRecordingStore();
    const oram = new PathORAM({ N: 16, bucketSize: 2, treeHeight: 3, stashCapacity: 8, seed: 'test-seed', store });

    // Prepare known data for a batch of ids and write them into ORAM
    const ids = ['blkA','blkB','blkC','blkD'];
    const writes = ids.map((id, i) => oram.access('write', id, { idx: i, payload: `val-${id}` }));
    await Promise.all(writes);

    // Build a Mixnet-like packet batch for a subset and include duplicates/dummies
    const interop = require('../../server/lib/oram/interop.cjs');
    const packets = ids.slice(0,3).map((id, i) => ({ id: `p${i}`, blockId: id }));

    // Process batch through interop with the real ORAM instance
    const res = await interop.processMixnetBatch(packets, { oram, batchSize: 8 });
    const results = res.results || [];

    // Verify that blocks read back match the written payloads
    for(const r of results){
      if(!r || !r.id) continue;
      const bid = r.id;
      if(String(bid).startsWith('dummy-')) continue;
      const expectedIdx = ids.indexOf(bid);
      if(expectedIdx === -1) continue; // unknown block
      if(!r.data) throw new Error(`Missing data for ${bid}`);
      const found = (typeof r.data === 'object') ? r.data : JSON.parse(JSON.stringify(r.data));
      if(String(found.payload || '') !== `val-${bid}`){
        throw new Error(`Data mismatch for ${bid}: got=${JSON.stringify(found)} expected payload=val-${bid}`);
      }
    }

    // analyze puts per key for overlap
    const byKey = new Map();
    for(const rec of store.puts){
      if(!byKey.has(rec.key)) byKey.set(rec.key, []);
      byKey.get(rec.key).push(rec);
    }

    for(const [key, arr] of byKey.entries()){
      arr.sort((a,b)=>a.start-b.start);
      for(let i=1;i<arr.length;i++){
        if(arr[i].start < arr[i-1].end){
          throw new Error(`Overlap detected on ${key}`);
        }
      }
    }

    console.log('ORAM-MIXNET FETCH SERIALIZATION: PASS');
    process.exit(0);
  }catch(err){
    console.error('ORAM-MIXNET FETCH SERIALIZATION: FAIL', err && err.stack?err.stack:err);
    process.exit(2);
  }
})();
