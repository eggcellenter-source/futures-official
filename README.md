# 期權官方資料平台：免費、免信用卡版本

此版本提供完整網站、官方資料與雲端更新流程。實際部署結果請查看儲存庫的 Actions／Pages；官方來源連線與最近排程紀錄顯示於網站「官方資料與更新」。工作流程檔存在不代表雲端驗證已成功。

使用 GitHub Free 公開儲存庫、GitHub Pages 和標準 Ubuntu GitHub Actions runner。無需租 VPS、購買網域或提供信用卡。這是靜態網站加定時雲端工作，沒有可 SSH 登入的常駐主機。網站與程式碼公開；擁有者已同意此部署方式。

## 本次公開的內容

五個分析頁、篩選及 CSV 匯出功能、官方擷取／計算程式，以及 2026-09-15～2026-10-20 共 23 個交易日的公開市場資料。套件不含既有私人網站設定、使用者帳號、API 金鑰、SSH 私鑰或付款資訊。

平台直接向期交所、證交所、櫃買中心取得資料，不依賴原站。版型參考：https://monsisa.github.io/futures-settle/board.html 。此網址只作來源註記，程式不會存取。

## 部署步驟

1. 使用 GitHub Free 帳號。若無帳號，使用 https://github.com/signup ，註冊、驗證與服務條款由使用者完成。不要選付費升級。
2. 建立公開儲存庫 `futures-official`，預設分支 `main`。上傳本套件根目錄的內容，必須包含 `.github/workflows/official-daily.yml`。也可先上傳經檢查的 `futures-official-source.zip`，再建立上述 workflow；首次執行會解開程式與歷史，通過官方驗證後提交。此初始化不覆寫 workflow。不要夾帶原私人平台資料夾。
3. 儲存庫 Settings → Pages → Build and deployment → Source 選 GitHub Actions。
4. Actions → Official daily data and Pages → Run workflow。date 留空。工作流程會從實際 GitHub 出口取得三家官方資料、驗證、保存歷史、產生五頁並發布。
5. 確認 build 和 deploy 都成功，打開部署回傳的真實網址，再檢查「官方資料與更新」中的資料日、GitHub 雲端擷取狀態與來源。三家同日資料都有效才算正式接通。
6. 檢查 Actions 排程已啟用、工作檔位於 main。第一次定時工作完成後，管理頁會顯示「最近一次自動執行」的實際時間。

如果 GitHub 出口也被櫃買拒絕，工作會失敗並保留上一個已發布版本。不要切換付費主機或宣稱完成；需重新評估免費且可連線的來源／執行環境。

## 每日更新

台北時間每日 18:30、22:30 執行（cron UTC 10:30、14:30）。電腦與網頁可關閉。官方尚無交易日資料時保留前一交易日。單一來源失敗或日期不一致時不發布。每次成功抓取及計算才提交資料，整個網站以同一版本發布。

手動補資料：在 Run workflow 的 date 輸入 YYYY-MM-DD。預設會從最近保存日補到目標日；超過 31 日先停止，需分批補資料。日常成功資料提交會留下真實更新紀錄。

GitHub 定時工作可能延遲，公開儲存庫連續 60 日沒有活動時可能停用排程。不是即時報價或保證準時的服務。發生失敗可查看 Actions；建議使用 GitHub 內建的工作失敗通知。

## 免費範圍

只使用公開儲存庫的標準 runner 與免費 Pages，部署成品僅保留 1 日。不設定付款方式、不用 larger runner、不購買網域。GitHub 的儲存及服務額度仍適用；沒有付款方式時超額會被阻擋。免費服務規則可能變更。

官方文件（2026-10-21 查核）：

- Pages 免費公開儲存庫：https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- Actions 免費與無付款方式的限制：https://docs.github.com/en/billing/concepts/product-billing/github-actions
- 定時工作規則：https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
- Pages 工作流程：https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## 本機驗證

需要 Node.js 24，無第三方 npm 套件，無需 npm install。

```sh
node --test tests/*.test.mjs
node scripts/build.mjs
node scripts/preview.mjs
```

預覽：http://127.0.0.1:5174/futures-official/ 。本機直接抓官方資料可執行 `node scripts/update.mjs`，再重新 build。本機成功不代表 GitHub 出口可用，仍須完成雲端實測。

## 計算範圍

股期溢價採官方結算價相對現貨收盤的每日溢價百分比平均；大型、小型及 ETF 標準契約按官方乘數加總，排除調整型契約。未額外還原除權息。融券增減以之前月結算日為基準。

PCR 使用期交所實際到期日及前一交易日資料，缺少樣本不推估勝率。法人方向分數與 z 分數最多使用最近 120 個已保存交易日；未滿 20 日不分級。OI Max Pain 遍歷履約價計算，日增減包含消失的履約價。

分析載入最近 180 個交易日，原始歷史仍保留。初始樣本只有上述 23 個交易日；結果可能與原站不同。
