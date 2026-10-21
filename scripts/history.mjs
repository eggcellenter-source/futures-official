import {readFile,readdir,writeFile,rename,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {OFFICIAL_HOSTS,offsetDate,NoTradingData,taipeiNow} from '../server/official.mjs';
export function validDate(date) {
  return typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T12:00Z'))&&new Date(date+'T12:00Z').toISOString().slice(0,10)===date;
}
export function validateSnapshot(d,date=d?.date) {
  if(!validDate(date)||d?.date!==date||d.version!==2||!Array.isArray(d.futures)||d.futures.length<100||!Array.isArray(d.options)||d.options.length<100||
    !d.contracts?.length||Object.keys(d.stocks||{}).length<200||!d.index?.close||d.index.date!==date||
    d.institutions?.length!==3||!Number.isFinite(d.pcr?.ratio)||!d.sources?.length)throw new Error(`${date} 官方快照不完整`);
  const agencies=new Set();
  for(const s of d.sources) {
    const u=new URL(s.url);
    if(u.protocol!=='https:'||u.username||u.password||!OFFICIAL_HOSTS.includes(u.hostname)||s.date!==date)throw new Error(`${date} 來源或日期不符`);
    agencies.add(s.agency);
  }
  if(!['TWSE','TPEx','TAIFEX'].every(a=>agencies.has(a)))throw new Error(`${date} 缺少官方機構`);
  return d;
}
export async function readHistory(root) {
  const dir=path.join(root,'data/history');
  const files=(await readdir(dir)).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  return Promise.all(files.map(async f=>validateSnapshot(JSON.parse(await readFile(path.join(dir,f),'utf8')),f.slice(0,10))));
}
export async function atomicJSON(file,value) {
  await mkdir(path.dirname(file),{recursive:true});
  const temp=file+'.tmp';await writeFile(temp,JSON.stringify(value));await rename(temp,file);
}
export async function collectUpdate(existing,{fetchDay,date,today=taipeiNow().slice(0,10)}={}) {
  if(!validDate(today)||!validDate(date)||date>today)throw new Error('日期必須是今天或過去有效的 YYYY-MM-DD');
  const latest=existing.at(-1)?.date;
  let from=latest&&latest<date?latest:date;
  if((Date.parse(date)-Date.parse(from))/86400000>31)throw new Error('距上次資料超過 31 日，請先以指定日期分批補齊');
  const staged=[],noData=[];
  // Recheck the latest stored day as well, so a holiday run still verifies all agencies.
  for(let d=from;d<=date;d=offsetDate(d,1)) {
    try {staged.push(validateSnapshot(await fetchDay(d),d));}
    catch(e){if(e instanceof NoTradingData)noData.push(d);else throw e;}
  }
  if(!staged.length)throw new Error('未取得可驗證的完整交易日；保留原資料');
  const merged=new Map(existing.map(d=>[d.date,d]));for(const d of staged)merged.set(d.date,d);
  return {days:[...merged.values()].sort((a,b)=>a.date.localeCompare(b.date)),staged,noData};
}
