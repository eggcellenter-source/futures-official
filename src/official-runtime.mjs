export const pages=['index','board','pcr','oi','inst'];
export const labels={index:'總覽',board:'溢價看板',pcr:'PCR 訊號',oi:'未平倉分布',inst:'法人 OP'};
export function escapeData(v) {
  if(typeof v==='string')return v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  if(Array.isArray(v))return v.map(escapeData);
  if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,escapeData(x)]));
  return v;
}
export function download(data,name,type='application/json') {
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
export function csvCell(v) {
  let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return `"${s.replaceAll('"','""')}"`;
}
export async function api(path,body) {
  if(body)throw new Error('請至 GitHub Actions 執行更新');
  const file=path==='/api/status'?'status':path.replace('/api/data/','');
  if(![...pages,'status'].includes(file))throw new Error('未知資料');
  const r=await fetch(new URL(`data/${file}.json`,document.baseURI),{cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(!r.headers.get('content-type')?.includes('application/json'))throw new Error('資料尚未發布或檔案路徑錯誤');
  const d=await r.json();if(!r.ok||d.status==='failed')throw new Error(d.error||'官方更新未成功');return d;
}
function status(text) {
  const bar=document.getElementById('platform-status');if(!bar)return;
  bar.replaceChildren();const span=document.createElement('span');span.textContent=text;bar.append(span);
  const a=document.createElement('a');a.href='manage.html';a.textContent='資料與更新紀錄';bar.append(a);
}
export async function loadData(page) {
  const {data,publication:p}=await api('/api/data/'+page);
  if(page==='board'&&!data.length)throw new Error('正在累積完整結算週期，請查看資料與更新紀錄');
  status(`官方資料 ${p.dataDate} · ${p.historyDays} 個交易日 · 更新 ${p.publishedAt}（台北）`);
  return escapeData(data);
}
export function finishPage(page) {
  document.getElementById('theme')?.setAttribute('aria-label','切換深淺色');
  document.querySelector('#cycsel select')?.setAttribute('aria-label','結算月');
  document.getElementById('exp-select')?.setAttribute('aria-label','到期月份');
  document.getElementById('q')?.setAttribute('aria-label','搜尋股名或代碼');
  if(page==='board') {
    const b=document.createElement('button');b.textContent='匯出表格 CSV';
    b.onclick=()=>{const table=document.getElementById('all-body').closest('table');download('\ufeff'+[...table.rows].map(r=>[...r.cells].map(c=>csvCell(c.textContent.trim())).join(',')).join('\r\n'),'官方股期篩選結果.csv','text/csv;charset=utf-8');};
    document.getElementById('q').closest('.toolbar').append(b);
  }
  document.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.matches('th.sortable')){e.preventDefault();e.target.click();}});
  document.querySelectorAll('th.sortable').forEach(th=>th.tabIndex=0);
}
window.addEventListener('unhandledrejection',e=>status(`資料載入未完成：${e.reason?.message||'請重新整理'}`));
