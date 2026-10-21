import {api,pages,download} from './official-runtime.mjs';
const $=id=>document.getElementById(id);
async function load() {
  const s=await api('/api/status'),p=s.publication,r=s.lastRun;
  $('summary').textContent=`資料日 ${p.dataDate}｜建置 ${p.publishedAt}（台北）｜${r.environment==='github-actions'?'GitHub 雲端擷取已驗證':'免費版已準備，尚未在 GitHub 實測或啟用'}`;
  $('schedule').textContent=`排程設定：台北 ${s.schedule.primary}、${s.schedule.retry}。${r.lastScheduledAt?`最近一次自動執行：${r.lastScheduledAt}。`:'尚無 GitHub 自動排程成功紀錄。'}`;
  if(r.checkedAt) {
    $('schedule').textContent+=` 最近成功檢查：${r.checkedAt}。`;
    if(Date.now()-Date.parse(r.checkedAt.replace(' ','T')+'+08:00')>72*3600000)$('schedule').textContent+=' 超過 72 小時未成功檢查，請查看工作紀錄。';
  }
  if(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(r.repository||'')) {
    $('workflow').href=`https://github.com/${r.repository}/actions/workflows/official-daily.yml`;$('workflow').hidden=false;
  }
  $('coverage').textContent=`歷史期間 ${p.historyStart}～${p.dataDate}，${p.historyDays} 個交易日。${p.boardCount} 檔股期，PCR ${p.pcrSamples} 個結算日，法人 ${p.institutionSamples} 個交易日。`;
  $('missing').textContent=s.missingTradingDays.length?`缺少交易日：${s.missingTradingDays.join('、')}`:'已保存期間內未發現缺漏交易日。';
  $('sources').replaceChildren();
  for(const source of p.sources) {
    const tr=document.createElement('tr');
    for(const value of [source.agency,new URL(source.url).pathname.split('/').at(-1),source.date]){const td=document.createElement('td');td.textContent=value;tr.append(td);}
    $('sources').append(tr);
  }
}
$('reload').onclick=()=>load().catch(e=>$('message').textContent=e.message);
$('export').onclick=async()=>{try{
  const entries=await Promise.all(pages.map(async p=>[p,await api('/api/data/'+p)]));
  download(JSON.stringify(Object.fromEntries(entries),null,2),'官方五頁資料備份.json');
}catch(e){$('message').textContent=e.message;}};
load().catch(e=>$('summary').textContent=e.message);
