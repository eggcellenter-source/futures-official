import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {readHistory} from './history.mjs';
import {calculateAll} from '../server/calculate.mjs';
import {taipeiNow} from '../server/official.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'public');
const days=(await readHistory(root)).slice(-180);
if(!days.length)throw new Error('沒有官方資料可發布');
const data=calculateAll(days),latest=days.at(-1);
const publication={dataDate:latest.date,publishedAt:taipeiNow(),historyStart:days[0].date,historyDays:days.length,
  boardCycles:data.board.length,boardCount:data.board[0]?.rows.length||0,pcrSamples:data.pcr.meta.n_settle,
  institutionSamples:data.inst.meta.win_n,sources:latest.sources,rulesVersion:2};
let lastRun={status:'prepared',environment:'local',checkedAt:null,lastScheduledAt:null};
try{lastRun=JSON.parse(await readFile(path.join(root,'data/run.json'),'utf8'));}catch{}
const available=new Set(days.map(d=>d.date));
const missingTradingDays=[...new Set(days.flatMap(d=>d.indexHistory.map(b=>b.date)))].filter(d=>d>=days[0].date&&d<=latest.date&&!available.has(d)).sort();
await import('./prepare-pages.mjs');
await mkdir(path.join(out,'data'),{recursive:true});
for(const [page,value] of Object.entries(data))await writeFile(path.join(out,`data/${page}.json`),JSON.stringify({data:value,publication}));
await writeFile(path.join(out,'data/status.json'),JSON.stringify({publication,lastRun,missingTradingDays,
  schedule:{timezone:'Asia/Taipei',primary:'每日 18:30',retry:'每日 22:30',verified:lastRun.environment==='github-actions',lastScheduledAt:lastRun.lastScheduledAt}}));
await writeFile(path.join(out,'.nojekyll'),'');
console.log(JSON.stringify({built:true,date:publication.dataDate,historyDays:days.length,cloudVerified:lastRun.environment==='github-actions'}));
