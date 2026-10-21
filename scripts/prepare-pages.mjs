import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'public');
await mkdir(path.join(out,'assets'),{recursive:true});
for(const [page,variable] of Object.entries({index:'D',board:'RAW',pcr:'DATA',oi:'DATA',inst:'DATA'})) {
  let html=await readFile(path.join(root,`templates/${page}.html`),'utf8');
  html=html.replace(new RegExp(`^const ${variable} = .+;$`,'m'),`const ${variable} = await loadData('${page}');`);
  html=html.replace('<script>',`<script type="module">\nimport {loadData,finishPage} from './assets/official-runtime.mjs';`)
    .replace('</script>',`\nfinishPage('${page}');\n</script>`)
    .replace(/(?:cyc|hub|pcr|oi|inst)-theme/g,'futures-platform-theme');
  html=html.replace(/重跑 <code>[^<]+<\/code> 更新後再發佈即為最新。/g,'本平台直接由三個官方機構取得資料；排程狀態請查看資料與更新紀錄。')
    .replace(/重跑 <code>[^<]+<\/code> 更新。/g,'由官方資料獨立計算。')
    .replace(/兩個工具的資料都在.*?快照更新於/,'官方資料計算更新於')
    .replace('週三選不跌86-88%','官方樣本歷史機率');
  html=html.replace('採結算價可自動反映除息(除息前貼水會被還原),為套利真實價差。','未額外還原除權息，除權息附近需留意比較基準。')
    .replace('用結算價自動反映除息','使用官方結算價，未額外還原除權息')
    .replace('歷史高強度月結算週勝率約7成','請搭配當期市場走勢評估')
    .replace(/歷史驗證:高軋空強度月結算週平均\+1\.9%、上漲勝率73%\(低強度月−1\.1%、40%\)。/g,'')
    .replace(/歷史經驗:2025 全年 ≤324,2026 皆 400\+;/g,'沿用觀察門檻：')
    .replace(/2025 全年≤324、2026 皆≥350;/g,'沿用觀察門檻：')
    .replace(/以<b>週三選\(含月選\)<\/b>最準\(下方 100–120 區間不跌率 86–88%\);週五選較弱。此為機率傾向,非保證。/g,'下方機率依已保存的官方樣本重算；小樣本僅供觀察。')
    .replace('結算日</b> = 每週三、週五、及月選第3個週三;遇假日順延次一營業日。','結算日</b> = 期交所資料中的實際契約到期日，包含休市調整。');
  html=html.replace('週三選(含月選):到期在週三,作結算誘因最強、訊號最乾淨。','週三選與月選的實際到期日樣本，依官方契約到期日歸類。')
    .replace('週五選:訊號較弱、較雜,實戰以週三/月選為主。','週五選的實際到期日樣本，包含官方休市調整。')
    .replace('紅K或下引線機率高(偏多守)','觀察紅K或下影線（樣本見下表）')
    .replace('黑K或上引線機率高(偏空壓)','觀察黑K或上影線（樣本見下表）');
  html=html.replace("${M.z}","${M.z==null?'—':M.z}").replace("${M.pct}","${M.pct==null?'—':M.pct}");
  html=html.replace('${comma(r.short||0)}',"${r.short==null?'—':comma(r.short)}")
    .replace("${(r.short_chg||0)>0?'+':''}${comma(r.short_chg||0)}","${r.short_chg==null?'—':((r.short_chg>0?'+':'')+comma(r.short_chg))}");
  const nav=html.indexOf('<nav'),head=html.slice(0,nav),body=html.slice(nav);
  html=`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="三個官方交易機構直接供應的每日結算分析"><link rel="stylesheet" href="assets/platform.css">${head}</head><body>${body}</body></html>`;
  html=html.replace('</nav>','</nav><div id="platform-status" class="platform-status" role="status">正在讀取雲端官方資料…</div>')
    .replace('</body>','<footer class="platform-footer">官方資料獨立運作版 · <a href="manage.html">資料來源、計算範圍與更新紀錄</a></footer></body>');
  await writeFile(path.join(out,`${page}.html`),html);
}
for(const f of ['official-runtime.mjs','official-manage.mjs','platform.css'])await copyFile(path.join(root,'src',f),path.join(out,'assets',f));
await copyFile(path.join(root,'src/official-manage.html'),path.join(out,'manage.html'));
console.log('Official-data pages prepared in public/');
