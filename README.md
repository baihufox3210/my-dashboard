# Baihu 個人網站

以個人介紹、作品集與 Blog 為核心的網站，包含內容管理後台、音樂播放器，以及以彙總方式保存的流量分析。

## 功能

- 首頁、關於、Projects、Blog 與 Friends 頁面。
- 後台可管理個人介紹、網站設定、Projects、Friends、音樂與流量分析。
- Blog 與 Projects 支援 Markdown、封面圖片位置調整；Projects 可附加 PDF。
- 管理員可上傳及排序 MP3；播放狀態由全站播放器維持。
- 首頁留言板：訪客可留下暱稱、心情與留言（同一 IP 每 10 分鐘最多 3 則，含防機器人欄位）；後台可回覆或刪除，並看到留言者 IP。
- 文章閱讀：顯示閱讀時間與進度條、表情回應（每位訪客每種一次，可取消），每篇文章有可分享的網址 `/blog/post/:id`。
- RSS 訂閱：`/api/rss.xml`（最新 20 篇）。若網站有固定網址，可設定 `SITE_URL`（例如 `https://example.com`），RSS 連結就不必依請求推算。
- 頁尾顯示今日與累計瀏覽次數，以及即時線上人數（每個分頁每 30 秒回報一次，只存在伺服器記憶體）。
- 彩蛋：按 `` ` `` 或 `Ctrl/⌘ + K`（或頁尾的 `>_`）打開終端機，可用 `help`、`whoami`、`ls`、`cd`、`blog`／`read`、`guestbook`、`music`、`achievements`、`fortune` 等指令；輸入 Konami Code（↑↑↓↓←→←→BA）會下狐狸櫻花雨。
- 成就系統：瀏覽文章、留言、逛遍所有頁面、深夜造訪、找到彩蛋等會解鎖成就並跳出通知；成就只存在訪客自己的瀏覽器，不會上傳。
- 桌面與手機背景可分別調整。
- 流量統計：每次瀏覽（包含重複瀏覽）都會計入。每日彙總保存 120 天；逐筆紀錄（訪客 IP、時間、頁面與路徑、工作階段、來源網站、瀏覽器／作業系統、地區）預設保存 90 天，後台可依 IP 查詢每一筆瀏覽。

## 技術需求

- Node.js 22.5 或更新版本（伺服器使用 `node:sqlite`）。
- npm。

## 本機開發

建立 `.env`，至少設定管理員帳號與密碼：

```env
ADMIN_USERNAME=your-name
ADMIN_PASSWORD=use-a-unique-password-at-least-8-characters
```

密碼需至少 8 個字元；不要使用帳號 `admin` 或密碼 `change-me`。`.env` 已列入 Git 忽略，請勿將正式環境憑證提交到版本庫。

安裝依賴並啟動前後端：

```bash
npm install
npm run dev
```

Vite 開發伺服器提供前端，並將 `/api` 與 `/uploads` 請求代理至 Express API。管理員登入位於 `/login`，登入後台位於 `/admin`。

## 常用指令

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 啟動前端與本機 API 開發伺服器 |
| `npm run server` | 單獨啟動 Express API |
| `npm run lint` | 執行 ESLint |
| `npm test` | 執行 API 整合測試（使用暫存資料夾，不會動到 `data/`） |
| `npm run build` | 執行 TypeScript 檢查並建置前端至 `dist/` |
| `npm run preview` | 預覽已建置的前端；不會啟動 API |

## 色彩

所有顏色都定義在 `src/theme.css` 的 `--theme-*` 變數；`App.css` 只負責版面，不寫死顏色（陰影也共用 `--theme-shadow-rgb`）。主題色由 `background.ts` 依背景圖自動取色並設定在 `<body>`，衍生色（如 `--theme-selected`、`--theme-surface-muted`）因此宣告在 `:root, body`，會跟著背景變化。新增樣式時請使用這些變數。

## 專案結構

- `server/app.ts`：建立 Express app（中介層與路由掛載）；`server/index.ts` 只負責啟動。
- `server/routes/`：依功能拆分的 API 路由（文章、Projects、Friends、音樂、登入、流量、網站設定、公開資料）。
- `server/storage.ts`：JSON 資料檔（含依修改時間失效的快取）與 SQLite 流量統計。
- `server/tests/`：以 Node 內建測試執行器撰寫的 API 測試。
- `src/routes/routes.ts`：前端路由與 `navigate()`／`useLocationKey()`。
- `src/features/blog/api.ts`：API 呼叫與共用的 GET 快取；寫入成功後會讓相關快取失效。
- `src/pages/admin/`：後台外框與各管理區塊。

## 網站路徑

- `/`：首頁
- `/about`：個人介紹
- `/projects`：作品集
- `/blog`：文章列表
- `/friends`：友站
- `/login`：管理員登入
- `/admin`：管理後台總覽
- `/admin/home`、`/admin/site`、`/admin/projects`、`/admin/friends`、`/admin/music`、`/admin/traffic`：後台各管理頁面

## 內容與檔案儲存

伺服器首次啟動時會建立 `data/` 與必要的預設資料檔。文章、Projects、Friends、音樂清單、留言板（`guestbook.json`，含留言者 IP）、網站設定與管理活動紀錄存放於 `data/`；分析資料使用 SQLite；上傳圖片、PDF 與 MP3 存放於 `public/uploads/`。

這些執行期資料與上傳檔案不會提交到 Git。部署或搬遷時，請另外備份並安全地轉移需要保留的 `data/` 與 `public/uploads/` 內容；不要把管理員 session、旗標或其他私密設定公開。

## Markdown 暴雷標記

在文章、About 經歷或支援 Markdown 的內容中，用 `||暴雷內容||` 包住要先遮住的文字。預覽會以點狀圖樣遮住內容；點一下或以鍵盤 Enter／空白鍵即可顯示，再操作一次可重新遮住。這只是閱讀呈現效果，文字仍會存在公開文章資料中，請勿用它隱藏密碼或真正的機密。

## 登入頁彩蛋

登入表單後面沒有任何 SQL，也不會執行使用者輸入；伺服器先以固定時間比對正式管理員帳密，不符合時才比對下列彩蛋。彩蛋不建立 session、不算登入失敗，並有獨立的限流（每 IP 每分鐘 20 次）。

- **SQL 注入**：輸入常見的注入字串（如 `' OR 1=1 --`、`admin' --`、`UNION SELECT`）會播放一段假的「資料庫傾印」，最後揭曉這裡根本沒有資料庫。若設定了 flag，會一併顯示。
- **`admin` / `admin123`**：進入諷刺詐騙集團後台的彩蛋頁 `/panel`。所有資料都在瀏覽器隨機產生（手機號碼皆遮罩、非真實），每個按鈕都會跳出反詐騙說明，一段時間後畫面會被「165」接管。
- **模擬 PHP 後門**：在 `/panel` 的「上传模板」上傳含 `<?php` 的檔案，會開啟模擬的 webshell（可 `ls`、`cat`、`rm -rf` 等）。檔案只在瀏覽器內讀取顯示，**不會上傳、儲存或執行**，伺服器端也沒有任何 PHP。

flag 設定（選用）放在不納入 Git 的 `data/security-flags.json`，格式見 `server/security-flags.example.json`：

```json
{
  "challenges": {
    "sqlLogin": {
      "enabled": true,
      "flag": "FLAG{replace_with_your_own_flag}"
    }
  }
}
```

其他彩蛋：掃描器常探測的路徑（`/wp-admin`、`/phpmyadmin`、`/.env`、`/xmlrpc.php`、`/.git` 等）會顯示嘲諷頁面；`robots.txt` 裡有狐狸；終端機另有 `matrix`、`hack`、`coffee`；在鍵盤打出 `fox` 會有狐狸跑過畫面。

## 正式部署注意事項

`npm run build` 只建置前端。正式環境需另外執行 Express API（`npm run server`），並透過 HTTPS 反向代理將 `/api` 與 `/uploads` 路徑轉發至 API；前端路由需設定回退至 `index.html`。預設 API 綁定 `127.0.0.1:3001`，可透過 `PORT` 與 `API_HOST` 調整。

### 流量紀錄與隱私

逐筆流量紀錄會保存訪客 IP 與 User-Agent，屬於個人資料。請在網站上告知訪客會收集這些資料與其用途，並視需要調整保存天數：`ANALYTICS_EVENT_RETENTION_DAYS`（預設 90，範圍 1–365），超過天數的紀錄每天自動刪除。資料存放在 `data/analytics.sqlite`（權限 600），請勿公開或提交到 Git。

### 訪客地區

地區由伺服器本機的 IP 定位資料庫判斷，不會把訪客 IP 傳給第三方服務：

- 使用 [DB-IP](https://db-ip.com) 的 IP to City Lite 資料庫（`@ip-location-db/dbip-city-mmdb`，CC BY 4.0，需標示來源；後台已附註）。資料每月更新，執行 `npm update @ip-location-db/dbip-city-mmdb` 即可取得新版，或以 `GEOIP_DIR` 指向放有 `dbip-city-ipv4.mmdb`／`dbip-city-ipv6.mmdb` 的資料夾。
- 台灣的座標再依內政部鄉鎮市區界線（`taiwan-atlas`）換算成「縣市 + 鄉鎮市區」的中文名稱。資料庫只給出整個城市的預設點（例如「Taipei」）時，只會顯示到縣市，不會猜測行政區。
- IP 定位只是估計：行動網路與部分固網常被定位到台北或其他大城市，鄉鎮市區只對部分網段有意義。
- 資料庫會在第一次需要時載入記憶體（IPv4 約 25 MB、IPv6 約 70 MB，鄉鎮界線約 60 MB）。記憶體吃緊時可設定 `GEOIP_DISABLED=1` 停用，改為只採用代理標頭。
- 若可信任的反向代理提供 `CF-IPCountry`、`CF-IPCity`、`CF-IPLatitude`／`CF-IPLongitude`（或對應的 `X-Geo-*`）標頭，會優先採用。

為避免濫用，同一 IP 每分鐘最多記錄 60 次瀏覽。若 API 位於反向代理之後，必須設定 `TRUSTED_PROXY_IP`，伺服器才會採用代理提供的 `X-Real-IP`，否則記錄到的會是代理本身的位址。

正式環境請設定 `TRUSTED_PROXY_IP` 為實際連線到 API 的反向代理位址：伺服器只會採用該代理提供的 `X-Real-IP` 與地區標頭，其他來源的同名標頭一律忽略。地區由本機資料庫判斷，伺服器不會呼叫第三方 IP 查詢服務。`SITE_START_DATE` 可設定網站啟用日期；未設定時會以伺服器啟動時間作為預設值。`DATA_DIR` 與 `UPLOADS_DIR` 可改變資料與上傳檔的存放位置（預設為 `data/` 與 `public/uploads/`）。
