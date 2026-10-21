import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fetchMarketDay,offsetDate,NoTradingData,taipeiNow} from '../server/official.mjs';
import {readHistory,validateSnapshot,validDate,atomicJSON} from './history.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const from=process.env.BACKFILL_FROM||process.argv[2],to=process.env.BACKFILL_TO||process.argv[3]||taipeiNow().slice(0,10);
if(!validDate(from)||!validDate(to)||from>to||to>taipeiNow().slice(0,10)||(Date.parse(to)-Date.parse(from))/86400000>366)throw new Error('Backfill requires a valid past range of at most 366 days');
const existing=await readHistory(root),known=new Map(existing.map(d=>[d.date,d]));
const contracts=existing.at(-1)?.contracts,cache=new Map(),failed=[],noData=[];
async function cachedFetch(url,options={}) {
  const memo=!options.method&&/openapi\/v1\/tpex_|MI_5MINS_HIST/.test(String(url));
  if(!memo)return fetch(url,options);
  if(!cache.has(url))cache.set(url,fetch(url,options).then(async r=>({ok:r.ok,status:r.status,headers:[...r.headers],body:await r.arrayBuffer()})));
  try {const r=await cache.get(url);if(!r.ok)cache.delete(url);return new Response(r.body.slice(0),{status:r.status,headers:r.headers});}
  catch(e){cache.delete(url);throw e;}
}
for(let date=from;date<=to;date=offsetDate(date,1)) {
  if(known.has(date)){console.log(date+' verified cache');continue;}
  try {
    let d,lastError;
    for(let attempt=0;attempt<3;attempt++) {
      try {d=validateSnapshot(await fetchMarketDay(date,{contracts,fetcher:cachedFetch}),date);break;}
      catch(e){if(e instanceof NoTradingData)throw e;lastError=e;if(attempt<2)await new Promise(r=>setTimeout(r,2000*(attempt+1)));}
    }
    if(!d)throw lastError;
    await atomicJSON(path.join(root,'data/history',date+'.json'),d);known.set(date,d);
    console.log(JSON.stringify({date,stocks:Object.keys(d.stocks).length,futures:d.futures.length,status:'saved'}));
  } catch(e) {
    if(e instanceof NoTradingData){noData.push(date);console.log(date+' no trading');}
    else{failed.push({date,error:e.message});console.error(JSON.stringify(failed.at(-1)));}
  }
  await new Promise(r=>setTimeout(r,350));
}
const days=[...known.values()].sort((a,b)=>a.date.localeCompare(b.date));
const expected=[...new Set(days.flatMap(d=>d.indexHistory.map(b=>b.date)))].filter(d=>d>=from&&d<=to);
const missing=expected.filter(d=>!known.has(d));
const result={from,to,completedAt:taipeiNow(),tradingDays:days.filter(d=>d.date>=from&&d.date<=to).length,noData,failed,missing,status:failed.length||missing.length?'incomplete':'succeeded'};
await atomicJSON(path.join(root,'data/backfill.json'),result);console.log(JSON.stringify(result));
if(result.status!=='succeeded')throw new Error('Backfill incomplete; published website preserved. Re-run to resume verified days.');
