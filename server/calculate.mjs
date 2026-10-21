import {offsetDate, taipeiNow} from './official.mjs';
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const round=(n,d=3)=>n==null?null:Number(n.toFixed(d));
const cmp=(a,b)=>a.date.localeCompare(b.date);
const classify=code=>/W/.test(code)?'週三選':/F/.test(code)?'週五選':'月選';
function expiryList(days) {
  const all=new Map();
  for(const d of days) for(const o of d.options) if(o.expiry) all.set(o.code,{code:o.code,date:o.expiry,kind:classify(o.code)});
  return [...all.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export function makeBoard(days) {
  const latest=days.at(-1), expiries=expiryList(days), monthly=expiries.filter(e=>e.kind==='月選');
  const available=monthly.filter(e=>days.some(d=>d.date<e.date&&d.futures.some(f=>f.month===e.code))).filter(e=>e.date<=monthly.find(m=>m.date>=latest.date)?.date);
  const result=[];
  for(const expiry of available) {
    const prev=monthly.filter(e=>e.date<expiry.date).at(-1);
    if(!prev) continue; // Never invent a holiday-adjusted settlement boundary.
    const cycle=days.filter(d=>d.date>prev.date&&d.date<expiry.date), last=cycle.at(-1);
    if(!last) continue;
    const baseline=days.filter(d=>d.date<=prev.date).at(-1);
    const byStock=new Map();
    for(const c of last.contracts) { const group=byStock.get(c.stockCode)||[]; group.push(c); byStock.set(c.stockCode,group); }
    const rows=[];
    for(const [stock,contracts] of byStock) {
      const spot=last.stocks[stock]; if(!spot?.close) continue;
      const primary=contracts.slice().sort((a,b)=>b.multiplier-a.multiplier)[0];
      const points=[];
      for(const d of cycle) {
        const f=d.futures.find(f=>f.contract===primary.contract&&f.month===expiry.code), s=d.stocks[stock];
        if(f?.settle>0&&s?.close>0) points.push((f.settle-s.close)/s.close*100);
      }
      if(!points.length) continue;
      const prem=avg(points);
      let gross=0, oi=0, matched=0;
      for(const c of contracts) {
        const f=last.futures.find(f=>f.contract===c.contract&&f.month===expiry.code);
        if(f?.oi!=null) { gross+=f.oi*c.multiplier*spot.close/1e6; matched++; if(c.contract===primary.contract) oi=f.oi; }
      }
      if(!matched) continue;
      const first=cycle[0], baseShort=baseline?.stocks[stock]?.short ?? first.stocks[stock]?.previousShort;
      const shortChg=spot.short!=null&&baseShort!=null?spot.short-baseShort:null;
      rows.push({stock,name:spot.name,cyc_prem:round(prem),oi,mv_m:round(gross*Math.sign(prem),0),mult:primary.multiplier,
        risk:Math.round(prem*gross/100),short:spot.short,short_chg:shortChg,squeeze:prem<0&&shortChg>0?Math.round(-prem*shortChg):0,
        days:points.length,mark:'',rank_prem:0,rank_pos:0});
    }
    rows.slice().sort((a,b)=>b.cyc_prem-a.cyc_prem).forEach((r,i)=>r.rank_prem=i+1);
    rows.slice().sort((a,b)=>b.mv_m-a.mv_m).forEach((r,i)=>r.rank_pos=i+1);
    rows.forEach(r=>r.mark=r.rank_prem<=30?(r.rank_pos<=30?'strike':'trap'):'');
    const tx=cycle.map(d=>{const f=d.futures.find(f=>f.contract==='TX'&&f.month===expiry.code);return f&&d.index.close?(f.settle-d.index.close)/d.index.close*100:null;}).filter(n=>n!==null);
    const tsmc=rows.find(r=>r.stock==='2330')?.cyc_prem??null;
    result.push({meta:{data_date:last.date,updated:taipeiNow().slice(0,16),cycle_start:offsetDate(prev.date,1),settle_this:expiry.date,near_month:expiry.code,
      gate:tsmc!=null&&tsmc>=.2?'active':'rest',gate_pct:.2,tsmc_prem:tsmc,txf_prem:round(avg(tx)),txf_spike:tx.length?round(Math.max(...tx)):null,
      count:rows.length,strike_top:30,full_days:cycle.length,source:'official',history_start:cycle[0].date,baseline_complete:!!baseline},
      rows:rows.sort((a,b)=>b.risk-a.risk)});
  }
  return result.sort((a,b)=>b.meta.settle_this.localeCompare(a.meta.settle_this));
}
export function makeOI(days) {
  const d=days.at(-1),prev=days.at(-2), exps=[];
  const codes=[...new Set(d.options.map(o=>o.code))];
  for(const code of codes) {
    const current=d.options.filter(o=>o.code===code), expiry=current[0].expiry;
    if(!expiry || expiry<d.date) continue;
    const old=prev?.options.filter(o=>o.code===code)||[], oldBy=new Map(old.map(o=>[`${o.side}-${o.strike}`,o.oi]));
    const c=current.filter(o=>o.side==='C'), p=current.filter(o=>o.side==='P');
    if(!c.length||!p.length) continue;
    const total_c=c.reduce((s,r)=>s+r.oi,0),total_p=p.reduce((s,r)=>s+r.oi,0);
    const before=side=>old.filter(o=>o.side===side).reduce((s,r)=>s+r.oi,0);
    const max=a=>a.reduce((a,b)=>a.oi>=b.oi?a:b);
    const tops=arr=>arr.map(o=>({strike:o.strike,d:prev?o.oi-(oldBy.get(`${o.side}-${o.strike}`)||0):null})).filter(o=>o.d>0).sort((a,b)=>b.d-a.d).slice(0,5);
    const top_c=tops(c),top_p=tops(p),buckets=new Map();
    for(const o of current) {
      const lo=Math.floor(o.strike/500)*500, b=buckets.get(lo)||{lo,c:0,p:0,dc:0,dp:0,cp:0,pp:0};
      const side=o.side.toLowerCase(); b[side]+=o.oi;
      b['d'+side]+=prev?o.oi-(oldBy.get(`${o.side}-${o.strike}`)||0):0; buckets.set(lo,b);
    }
    // Strikes which disappeared are real negative OI changes.
    const nowKeys=new Set(current.map(o=>`${o.side}-${o.strike}`));
    for(const o of old) if(!nowKeys.has(`${o.side}-${o.strike}`)) {
      const lo=Math.floor(o.strike/500)*500,b=buckets.get(lo)||{lo,c:0,p:0,dc:0,dp:0,cp:0,pp:0};
      b['d'+o.side.toLowerCase()]-=o.oi;buckets.set(lo,b);
    }
    const bks=[...buckets.values()].map(b=>({...b,cp:round(total_c?b.c/total_c*100:0,1),pp:round(total_p?b.p/total_p*100:0,1)}));
    const strikes=[...new Set(current.map(o=>o.strike))].sort((a,b)=>a-b);
    let maxpain=null,least=Infinity;
    for(const k of strikes) {
      const pain=current.reduce((s,o)=>s+o.oi*Math.max(o.side==='C'?k-o.strike:o.strike-k,0),0);
      if(pain<least){least=pain;maxpain=k;}
    }
    exps.push({code,type:classify(code),expiry,days_to:Math.round((Date.parse(expiry)-Date.parse(d.date))/86400000),total_c,total_p,
      d_total_c:prev?total_c-before('C'):null,d_total_p:prev?total_p-before('P'):null,
      call_max:{strike:max(c).strike,oi:max(c).oi},put_max:{strike:max(p).strike,oi:max(p).oi},
      call_up:top_c[0]||null,put_up:top_p[0]||null,top_c,top_p,maxpain,buckets:bks});
  }
  return {meta:{data_date:d.date,prev_date:prev?.date||null,updated:taipeiNow().slice(0,16),spot:d.index.close,bucket:500,source:'official'},expiries:exps.sort((a,b)=>a.expiry.localeCompare(b.expiry))};
}
export function makeInstitutions(days) {
  const latest=days.at(-1),prev=days.at(-2);
  function score(d) {
    return d.institutions.filter(i=>i.key!=='dealer').reduce((s,i)=>s+(i.call.b-i.put.b)+.5*(i.put.s-i.call.s),0);
  }
  const values=days.slice(-120).map(score),bw=score(latest),mean=avg(values),sd=Math.sqrt(avg(values.map(v=>(v-mean)**2))||0);
  const z=values.length>=20&&sd?round((bw-mean)/sd,2):null;
  const pct=values.length>=20?Math.round(values.filter(v=>v<=bw).length/values.length*100):null;
  const level=z==null?'資料累積中':z<=-1.5?'強力偏空':z<=-.5?'偏空':z>=1.5?'強力偏多':z>=.5?'偏多':'中性';
  const direction=i=>i.call.net-i.put.net;
  const near=latest.options.filter(o=>/^\d{6}$/.test(o.code)&&o.expiry>=latest.date).sort((a,b)=>a.expiry.localeCompare(b.expiry))[0]?.code;
  function equivalent(side,amt,qty) {
    if(!qty||!near) return null;
    const price=amt/qty*20,opts=latest.options.filter(o=>o.code===near&&o.side===side&&o.settle>0);
    if(!opts.length) return null;
    return opts.reduce((a,b)=>Math.abs(a.settle-price)<=Math.abs(b.settle-price)?a:b).strike;
  }
  const insts=latest.institutions.map(i=>{
    const n=direction(i),prevI=prev?.institutions.find(p=>p.key===i.key);
    return {...i,note:i.key==='dealer'?'多為造市避險部位':'' ,dir_net:n,dir:n>0?'偏多':n<0?'偏空':'中性',dir_chg:prevI?n-direction(prevI):null,
      eq:{bc:equivalent('C',i.call.ba,i.call.b),sc:equivalent('C',i.call.sa,i.call.s),bp:equivalent('P',i.put.ba,i.put.b),sp:equivalent('P',i.put.sa,i.put.s)}};
  });
  const trendDays=days.slice(-5),trend={dates:trendDays.map(d=>d.date.slice(5).replace('-','/'))};
  for(const key of ['foreign','trust','dealer']) trend[key]=trendDays.map(d=>direction(d.institutions.find(i=>i.key===key)));
  trend.sum=trend.foreign.map((v,i)=>v+trend.trust[i]); trend.bw=trendDays.map(score);
  const sum_dir=insts.filter(i=>i.key!=='dealer').reduce((s,i)=>s+i.dir_net,0);
  return {meta:{data_date:latest.date,prev_date:prev?.date||null,updated:taipeiNow().slice(0,16),level,z,pct,bw,win_n:values.length,sum_dir,
    sum_lab:sum_dir>0?'偏多':sum_dir<0?'偏空':'中性',eq_spot:latest.index.close,eq_exp:near,source:'official'},insts,trend};
}
export function makePCR(days) {
  const latest=days.at(-1), exps=expiryList(days), index=new Map(days.flatMap(d=>d.indexHistory).map(x=>[x.date,x]));
  const records=[];
  for(const e of exps.filter(e=>e.date<=latest.date)) {
    const bar=index.get(e.date),prior=days.filter(d=>d.date<e.date).at(-1);
    const priorIndex=[...index.values()].filter(i=>i.date<e.date).sort(cmp).at(-1);
    if(!bar||!prior?.pcr||!priorIndex||prior.date!==priorIndex.date) continue;
    const red=bar.close>bar.open,range=bar.high-bar.low,lower=Math.min(bar.open,bar.close)-bar.low,upper=bar.high-Math.max(bar.open,bar.close);
    const lf=range>0&&lower>=range/3,uf=range>0&&upper>=range/3;
    records.push({d:e.date,kind:e.kind,pcr:prior.pcr.ratio,red,notfall:red||lf,notrise:bar.close<bar.open||uf,result:lf?'守':uf?'壓':'',ret:round((bar.close/priorIndex.close-1)*100,2)});
  }
  const definitions=[['<90',-Infinity,90],['90–100',90,100],['100–110',100,110],['110–120',110,120],['≥120',120,Infinity]];
  const buckets={};
  for(const group of ['wed','all','fri']) buckets[group]=definitions.map(([label,lo,hi])=>{
    const arr=records.filter(r=>(group==='all'||(group==='wed'?r.kind!=='週五選':r.kind==='週五選'))&&r.pcr>=lo&&r.pcr<hi);
    return {label,n:arr.length,notfall:arr.length?Math.round(arr.filter(r=>r.notfall).length/arr.length*100):null,
      notrise:arr.length?Math.round(arr.filter(r=>r.notrise).length/arr.length*100):null,ret:round(avg(arr.map(r=>r.ret)),2)};
  });
  const next=exps.find(e=>e.date>latest.date);
  return {meta:{updated:taipeiNow().slice(0,16),latest_pcr_date:latest.date,latest_pcr:latest.pcr.ratio,signal:latest.pcr.ratio>=100?'not_fall':'not_rise',pivot:100,
    next_settle:next?{date:next.date,kind:next.kind,weekday:'日一二三四五六'[new Date(next.date+'T12:00Z').getUTCDay()]}:null,
    n_settle:records.length,range:records.length?`${records[0].d} ~ ${records.at(-1).d}`:'尚無完整樣本',source:'official'},buckets,recent:records.slice(-40)};
}
export function calculateAll(input) {
  const days=input.slice().sort(cmp);
  if(!days.length) throw new Error('尚無官方資料');
  const board=makeBoard(days),oi=makeOI(days),inst=makeInstitutions(days),pcr=makePCR(days),b=board[0],o=oi.expiries.find(e=>e.days_to>=1)||oi.expiries[0];
  const index={updated:taipeiNow().slice(0,16),source:'official',board:{near_month:b?.meta.near_month||'資料累積中',sell:b?.rows.reduce((s,r)=>s+Math.max(r.risk,0),0)||0,
    sqz:b?.rows.reduce((s,r)=>s+r.squeeze,0)||0,tsmc:b?.meta.tsmc_prem??null,gate:b?.meta.gate||'rest'},
    pcr:{latest_pcr:pcr.meta.latest_pcr,signal:pcr.meta.signal,next:pcr.meta.next_settle},
    oi:{spot:oi.meta.spot,expiry:o?.expiry,type:o?.type,support:o?.put_max.strike,resistance:o?.call_max.strike,maxpain:o?.maxpain},
    inst:{level:inst.meta.level,pct:inst.meta.pct,z:inst.meta.z,date:inst.meta.data_date,win_n:inst.meta.win_n}};
  return {index,board,pcr,oi,inst};
}
