export const SOURCE_VERSION = 2;
export const OFFICIAL_HOSTS = ['www.taifex.com.tw', 'openapi.taifex.com.tw', 'www.twse.com.tw', 'www.tpex.org.tw'];
export class NoTradingData extends Error { constructor(date) { super(`${date} 尚無官方交易資料`); this.code = 'NO_TRADING_DATA'; } }
export const number = value => {
  if (value == null || String(value).trim() === '') return null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
};
export const isoDate = value => {
  const s = String(value).replace(/[^0-9]/g, '');
  if (s.length === 8) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  if (s.length === 7) return `${Number(s.slice(0,3))+1911}-${s.slice(3,5)}-${s.slice(5,7)}`;
  return null;
};
export const taipeiNow = () => new Date().toLocaleString('sv-SE', { timeZone:'Asia/Taipei' });
export const offsetDate = (d, n) => new Date(Date.parse(d+'T12:00:00Z') + n*86400000).toISOString().slice(0,10);
export function parseCSV(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i=0; i<text.length; i++) {
    const c=text[i];
    if (c==='"') { if (quoted && text[i+1]==='"') { cell+='"'; i++; } else quoted=!quoted; }
    else if (c===',' && !quoted) { row.push(cell.trim()); cell=''; }
    else if ((c==='\n'||c==='\r') && !quoted) {
      if(c==='\r'&&text[i+1]==='\n') i++;
      row.push(cell.trim()); if(row.some(Boolean)) rows.push(row); row=[]; cell='';
    } else cell+=c;
  }
  if(cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows;
}
const stripHTML = s => s.replace(/<[^>]*>/g,'').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').trim();
export function htmlRows(html) {
  return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m =>
    [...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c=>stripHTML(c[1])));
}
function checkTable(data, date, select, label) {
  const t=(data.tables||[]).find(select);
  if (!t || !Array.isArray(t.data) || !t.data.length) throw new Error(`${label} ${date} 空白或格式變更`);
  if (data.date && isoDate(data.date)!==date) throw new Error(`${label} 日期不符`);
  return t.data;
}
export function normalizeEquities(date, twQuotes, twMargin, otcQuotes, otcMargin) {
  const result={};
  for(const r of checkTable(twQuotes,date,t=>t.fields?.includes('證券代號')&&t.fields?.includes('收盤價'),'證交所行情')) {
    if (number(r[8])>0) result[r[0]]={name:r[1],market:'twse',close:number(r[8]),short:null,previousShort:null};
  }
  for(const r of checkTable(otcQuotes,date,t=>t.title?.includes('上櫃股票行情'),'櫃買行情')) {
    if(number(r[2])>0) result[r[0]]={name:r[1],market:'tpex',close:number(r[2]),short:null,previousShort:null};
  }
  for(const r of checkTable(twMargin,date,t=>t.title?.includes('融資融券彙總')&&t.fields?.[0]==='代號','證交所融券')) {
    if(result[r[0]]) Object.assign(result[r[0]],{short:number(r[12]),previousShort:number(r[11])});
  }
  for(const r of checkTable(otcMargin,date,t=>t.title?.includes('上櫃股票融資融券餘額'),'櫃買融券')) {
    if(result[r[0]]) Object.assign(result[r[0]],{short:number(r[14]),previousShort:number(r[10])});
  }
  return result;
}
export function normalizeFutures(date, text) {
  const rows=parseCSV(text), header=rows.shift();
  if(!header?.includes('結算價') || !header.includes('交易時段')) throw new Error('期交所期貨 CSV 格式變更');
  return rows.filter(r=>isoDate(r[0])===date&&r[17]==='一般'&&/^\d{6}$/.test(r[2])&&number(r[10])>0)
    .map(r=>({contract:r[1],month:r[2],settle:number(r[10]),oi:number(r[11]),volume:number(r[9])}));
}
export function normalizeOptions(date, text) {
  const rows=parseCSV(text),header=rows.shift();
  if(!header?.includes('契約到期日')) throw new Error('期交所選擇權 CSV 缺少實際到期日');
  return rows.filter(r=>isoDate(r[0])===date&&r[1]==='TXO'&&r[17]==='一般'&&number(r[11])!==null)
    .map(r=>({code:r[2],expiry:isoDate(r[20]),strike:number(r[3]),side:r[4]==='買權'?'C':'P',settle:number(r[10]),oi:number(r[11])}));
}
export function normalizeInstitutions(date, text) {
  const rows=parseCSV(text),header=rows.shift();
  if(!header?.includes('買方未平倉口數')) throw new Error('期交所法人 CSV 格式變更');
  const keys={'自營商':'dealer','投信':'trust','外資及陸資':'foreign'}, out={};
  for(const r of rows.filter(r=>isoDate(r[0])===date)) {
    const key=keys[r[3]]; if(!key) continue;
    const i=out[key] ||= {key,name:key==='foreign'?'外資':r[3]};
    i[r[2]==='CALL'?'call':'put']={b:number(r[10]),ba:number(r[11]),s:number(r[12]),sa:number(r[13]),net:number(r[14]),amt:number(r[15])};
  }
  if(Object.values(out).length!==3 || Object.values(out).some(i=>!i.call||!i.put||i.call.b===null||i.put.b===null)) throw new Error('法人資料不完整');
  return Object.values(out);
}
export function normalizePCR(date,text) {
  const rows=parseCSV(text),header=rows.shift(), row=rows.find(r=>isoDate(r[0])===date);
  if(!header?.some(x=>x.includes('未平倉量')) || !row || number(row[6])===null) throw new Error('PCR 資料未齊');
  return {date,putOI:number(row[4]),callOI:number(row[5]),ratio:number(row[6])};
}
export function normalizeIndex(data) {
  if(!Array.isArray(data.data)) throw new Error('加權指數 OHLC 資料未齊');
  return data.data.map(r=>({date:isoDate(r[0]),open:number(r[1]),high:number(r[2]),low:number(r[3]),close:number(r[4])}))
    .filter(r=>r.date&&r.close>0&&r.open>0);
}
export function normalizeContracts(html, ssf) {
  const rows=htmlRows(html), map=[];
  for(const s of ssf) {
    const short=s.Contract.replace(/F$/,'');
    const row=rows.find(r=>r.some(c=>c===short||c===s.Contract)&&r.some(c=>c===s.StockCode));
    if(!row) continue;
    const shareCell=row.find(c=>/^(?:[\d,]+)\s*(?:股|受益權單位|單位)$/.test(c.replace(/\s/g,'')));
    let multiplier=shareCell?number(shareCell.replace(/[^\d,]/g,'')):null;
    if(!multiplier) {
      const codeIdx=row.findIndex(c=>c===s.StockCode);
      const candidates=row.slice(codeIdx+1).map(number).filter(n=>[100,1000,2000,10000].includes(n));
      multiplier=candidates[0]||null;
    }
    if(multiplier) map.push({contract:s.Contract,stockCode:s.StockCode,name:s.StockName,multiplier});
  }
  if(map.length<200 || map.length<ssf.length*0.95) throw new Error(`股票期貨乘數表不完整 (${map.length}/${ssf.length})`);
  return map;
}
export async function officialRequest(url, options={}, fetcher=fetch) {
  if(!OFFICIAL_HOSTS.includes(new URL(url).hostname)) throw new Error('只允許官方資料來源');
  let last;
  for(let attempt=0; attempt<3; attempt++) {
    try {
      const r=await fetcher(url,{...options,headers:{'User-Agent':'Mozilla/5.0 (compatible; FuturesSettlementResearch/2.0)','Accept':'*/*',...options.headers},redirect:'manual',signal:AbortSignal.timeout(25000)});
      if(!r.ok) throw new Error(`HTTP ${r.status} ${new URL(url).hostname}`);
      return r;
    } catch(e) { last=e; if(attempt<2) await new Promise(r=>setTimeout(r,500*(attempt+1))); }
  }
  throw last;
}
export async function fetchTpexBridge(date,bridge,fetcher=fetch) {
  const origin=new URL(bridge.url);
  if(origin.protocol!=='https:'||origin.username||origin.password)throw new Error('台灣擷取服務必須使用 HTTPS');
  const response=await fetcher(new URL('/v1/tpex',origin),{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${bridge.token}`},
    body:JSON.stringify({date}),redirect:'manual',signal:AbortSignal.timeout(90000)});
  if(!response.ok)throw new Error(`台灣擷取服務 HTTP ${response.status}`);
  const data=await response.json();
  if(data.date!==date||!data.sources?.length||data.sources.some(s=>new URL(s.url).hostname!=='www.tpex.org.tw'||s.date!==date))throw new Error('台灣擷取服務的官方日期或來源不符');
  if(data.quotes?.date!==date.replaceAll('-','')||data.margin?.date!==date.replaceAll('-',''))throw new Error('櫃買資料日期不符');
  return data;
}
export async function fetchMarketDay(date, {fetcher=fetch, contracts:preloaded=null,tpexBridge=null}={}) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('日期格式錯誤');
  const compact=date.replaceAll('-',''), slash=date.replaceAll('-','/'), evidence=[];
  async function json(agency,url) {
    const r=await officialRequest(url,{},fetcher); const data=await r.json();
    evidence.push({agency,url,date,fetchedAt:new Date().toISOString()}); return data;
  }
  async function csv(path,fields) {
    const url=`https://www.taifex.com.tw/cht/3/${path}`;
    const r=await officialRequest(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({queryStartDate:slash,queryEndDate:slash,...fields})},fetcher);
    const text=new TextDecoder('big5').decode(await r.arrayBuffer());
    evidence.push({agency:'TAIFEX',url,date,parameters:{queryStartDate:slash,queryEndDate:slash,...fields},fetchedAt:new Date().toISOString()}); return text;
  }
  async function otc(kind) {
    const isQuote=kind==='quotes';
    const url='https://www.tpex.org.tw/openapi/v1/'+(isQuote?'tpex_mainboard_daily_close_quotes':'tpex_mainboard_margin_balance');
    try {
      const response=await officialRequest(url,{},fetcher),rows=await response.json();
      if(!Array.isArray(rows)||!rows.length||rows.some(r=>isoDate(r.Date)!==date))throw new Error('櫃買 OpenAPI 日期不符');
      const data=rows.map(r=>{
        if(isQuote)return [r.SecuritiesCompanyCode,r.CompanyName,r.Close];
        const a=Array(15).fill(null);a[0]=r.SecuritiesCompanyCode;a[1]=r.CompanyName;
        a[10]=r.ShortSaleBalancePreviousDay;a[14]=r.ShortSaleBalance;return a;
      });
      evidence.push({agency:'TPEx',url,date,fetchedAt:new Date().toISOString()});
      return {date:compact,tables:[{title:isQuote?'上櫃股票行情':'上櫃股票融資融券餘額',data}]};
    } catch {
      // OpenAPI is latest-day only. Historical dates use the official dated API.
      const endpoint=isQuote?'afterTrading/dailyQuotes':'margin/balance';
      return json('TPEx',`https://www.tpex.org.tw/www/zh-tw/${endpoint}?date=${encodeURIComponent(slash)}&id=&response=json`);
    }
  }
  const twQuotes=await json('TWSE',`https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date=${compact}&type=ALLBUT0999&response=json`);
  const qt=twQuotes.tables?.find(t=>t.fields?.includes('證券代號'));
  if(!qt?.data?.length) {
    if(String(twQuotes.stat).includes('沒有符合')) throw new NoTradingData(date);
    throw new Error('證交所行情格式變更或服務異常');
  }
  const bridgePromise=tpexBridge?fetchTpexBridge(date,tpexBridge,fetcher).then(d=>{evidence.push(...d.sources.map(s=>({...s,transport:'taiwan-collector'})));return d;}):null;
  const collected=await Promise.allSettled([
    json('TWSE',`https://www.twse.com.tw/rwd/zh/marginTrading/MI_MARGN?date=${compact}&selectType=ALL&response=json`),
    bridgePromise?bridgePromise.then(d=>d.quotes):otc('quotes'),
    bridgePromise?bridgePromise.then(d=>d.margin):otc('margin'),
    csv('futDataDown',{down_type:'1',commodity_id:'all',commodity_id2:''}),
    csv('optDataDown',{down_type:'1',commodity_id:'TXO',commodity_id2:''}),
    csv('pcRatioDown',{}),
    csv('callsAndPutsDateDown',{commodityId:'TXO'}),
    json('TWSE',`https://www.twse.com.tw/rwd/zh/TAIEX/MI_5MINS_HIST?date=${compact.slice(0,6)}01&response=json`),
  ]);
  const failures=collected.flatMap((r,i)=>r.status==='rejected'?[`${['上市融券','上櫃行情','上櫃融券','期貨','選擇權','PCR','法人','加權指數'][i]}：${r.reason.message}`]:[]);
  if(failures.length)throw new Error(failures.join('；'));
  const values=collected.map(r=>r.value);
  let contracts=preloaded;
  if(!contracts) {
    const ssf=await json('TAIFEX','https://openapi.taifex.com.tw/v1/SSFLists');
    const url='https://www.taifex.com.tw/cht/2/stockLists';
    const response=await officialRequest(url,{},fetcher);
    contracts=normalizeContracts(await response.text(),ssf);
    evidence.push({agency:'TAIFEX',url,date,fetchedAt:new Date().toISOString()});
  }
  const stocks=normalizeEquities(date,twQuotes,values[0],values[1],values[2]);
  const universe=new Set(contracts.map(c=>c.stockCode));
  const futures=normalizeFutures(date,values[3]);
  const options=normalizeOptions(date,values[4]);
  const pcr=normalizePCR(date,values[5]);
  const institutions=normalizeInstitutions(date,values[6]);
  const indexHistory=normalizeIndex(values[7]), index=indexHistory.find(x=>x.date===date);
  if(futures.length<100||options.length<100||!index) throw new Error('期貨、選擇權或加權指數資料未齊');
  const matched=Object.keys(stocks).filter(k=>universe.has(k));
  if(matched.length<200) throw new Error('股期現貨配對數量不足');
  return {version:SOURCE_VERSION,date,fetchedAt:taipeiNow(),sources:evidence,contracts,stocks:Object.fromEntries(matched.map(k=>[k,stocks[k]])),futures,options,pcr,institutions,index,indexHistory};
}
