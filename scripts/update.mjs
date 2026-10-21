import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {fetchMarketDay,taipeiNow,offsetDate} from '../server/official.mjs';
import {calculateAll} from '../server/calculate.mjs';
import {readHistory,collectUpdate,atomicJSON} from './history.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const now=taipeiNow(),today=now.slice(0,10),defaultDate=Number(now.slice(11,13))<18?offsetDate(today,-1):today;
const date=process.env.REQUESTED_DATE||process.argv[2]||defaultDate;
const existing=await readHistory(root);
const result=await collectUpdate(existing,{fetchDay:fetchMarketDay,date,today});
// Fail before any persisted update if the combined history cannot be calculated.
calculateAll(result.days.slice(-180));
for(const day of result.staged)await atomicJSON(path.join(root,`data/history/${day.date}.json`),day);
let previous={};try{previous=JSON.parse(await readFile(path.join(root,'data/run.json'),'utf8'));}catch{}
const repository=process.env.GITHUB_ACTIONS==='true'&&/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(process.env.GITHUB_REPOSITORY||'')?process.env.GITHUB_REPOSITORY:null;
const run={status:'succeeded',environment:repository?'github-actions':'local',checkedAt:taipeiNow(),
  date:result.days.at(-1).date,verifiedDates:result.staged.map(d=>d.date),noDataDates:result.noData,
  repository,runUrl:repository&&/^\d+$/.test(process.env.GITHUB_RUN_ID||'')?`https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`:null,
  lastScheduledAt:repository&&process.env.GITHUB_EVENT_NAME==='schedule'?taipeiNow():(previous.lastScheduledAt||null)};
await atomicJSON(path.join(root,'data/run.json'),run);
console.log(JSON.stringify({status:run.status,environment:run.environment,dataDate:run.date,verifiedDates:run.verifiedDates,noData:run.noDataDates}));
