import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {collectUpdate,validateSnapshot,validDate} from '../scripts/history.mjs';
import {NoTradingData,offsetDate} from '../server/official.mjs';
import {calculateAll} from '../server/calculate.mjs';
const seed=JSON.parse(await readFile(new URL('../data/history/2026-10-20.json',import.meta.url),'utf8'));
function shifted(date){const d=structuredClone(seed);d.date=date;d.index.date=date;d.sources.forEach(s=>s.date=date);return d;}
test('reject invalid dates and unofficial or mismatched provenance',()=>{
  assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('../../secret'),false);
  const d=structuredClone(seed);d.sources[0].url='https://example.com/data';
  assert.throws(()=>validateSnapshot(d),/來源或日期/);
  const m=structuredClone(seed);m.sources[0].date='2026-10-19';assert.throws(()=>validateSnapshot(m),/來源或日期/);
  const missing=structuredClone(seed);delete missing.futures;assert.throws(()=>validateSnapshot(missing),/快照不完整/);
});
test('a later source failure never modifies the supplied history',async()=>{
  const history=[structuredClone(seed)],before=JSON.stringify(history);
  await assert.rejects(collectUpdate(history,{date:'2026-10-21',today:'2026-10-21',
    fetchDay:async date=>{if(date==='2026-10-21')throw new Error('TPEx unavailable');return shifted(date);}}),/TPEx unavailable/);
  assert.equal(JSON.stringify(history),before);
});
test('holidays preserve last valid snapshot while still verifying agencies',async()=>{
  const date=offsetDate(seed.date,1);
  const r=await collectUpdate([seed],{date,today:date,fetchDay:async d=>{if(d===date)throw new NoTradingData(d);return structuredClone(seed);}});
  assert.equal(r.days.at(-1).date,seed.date);assert.deepEqual(r.noData,[date]);assert.equal(r.staged.length,1);
});
test('official fixture produces all five datasets with the actual sample count',()=>{
  const result=calculateAll([seed]);
  assert.deepEqual(Object.keys(result).sort(),['board','index','inst','oi','pcr']);
  assert.equal(result.index.inst.win_n,1);assert.equal(result.inst.meta.z,null);
  assert.ok(result.oi.expiries.length>0);assert.equal(result.index.oi.spot,seed.index.close);
});
