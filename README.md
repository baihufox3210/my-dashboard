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
- 彩蛋：按 `` ` `` 或 `Ctrl/⌘ + K`（或頁尾的 `>_`）打開終端機，可用 `help`、`whoami`、`ls`、`cd`、`blog`／`read`、`guestbook`、`music`、`achievements`、`fortune` 等指令；完整彩蛋清單見 [EASTER_EGGS.md](EASTER_EGGS.md)。
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

## 文章與專案編輯器

Blog 文章（`/blog/new`、`/blog/edit/:id`）與 Projects 專案用同一套編輯視窗：標題列、分組欄位、固定在底部的取消／儲存，內容欄位則是共用的 `MarkdownEditor`（`src/components/MarkdownEditor.tsx`）。

- 外觀像程式編輯器：有行號、目前行反白，標題、引用、圖片、程式碼各有顏色。
- 輸入 `/` 叫出選單：圖片、內文、標題 1–3、項目／編號／待辦清單、引用、程式碼區塊、分隔線、表格、暴雷、連結；繼續打字可篩選（中英文皆可，如 `/h2`、`/圖`），↑↓ 選擇、Enter 套用、Esc 關閉。
- 選取文字會浮出格式列：內文／H1／H2／H3／引用／清單，以及粗體、斜體、刪除線、程式碼、連結、暴雷。`⌘/Ctrl + B`、`I`、`E`、`K` 也可以。
- 圖片可從 `/` 選單上傳、直接貼上或拖進編輯區，會插在游標位置；在 `![ ]` 的中括號裡輸入文字就是圖說。HEIC、AVIF 或超過 8 MB 的圖片會先在瀏覽器轉檔。
- 在清單或引用中按 Enter 會自動接續下一項，空的項目再按一次 Enter 結束清單。
- 「編輯／並排／預覽」切換檢視（並排只在夠寬時出現）。
- 文章尚未儲存的內容會暫存在這台裝置，下次打開同一篇可恢復；`⌘/Ctrl + S` 儲存。
- 從內容移除的圖片，以及刪除文章或專案時內文中的圖片，會一併從 `uploads` 刪除。

## 封面圖片

文章與專案的封面在所有地方（列表卡片、首頁、內文、編輯器預覽、調整視窗）都由 `CoverImage` 以同一個固定比例顯示，比例定義在 `src/App.css` 的 `--cover-ratio`（預設 4:1 寬幅），改這一個值全站一起變。位置（0–100%）代表畫框在圖片超出範圍內的位置，縮放以同一點為中心，所以在調整視窗看到的裁切就是實際顯示的裁切，放大後也能拖到圖片的任何一邊。

## 分享連結的預覽

文章（`/blog/post/:id`）與專案（`/projects/:id`）的連結貼到 Discord、LINE、Facebook、X 等地方時，會顯示標題、摘要與封面。預覽機器人不會執行 JavaScript，所以這兩種網址由 API 回傳「同一份建置好的頁面，加上 Open Graph 標籤」（`server/routes/share.ts`）：

- nginx 要把這兩種網址轉給 API，設定在 `deploy/nginx-default.conf`；API 沒開或找不到建置結果時，nginx 會改送原本的靜態頁面。
- API 讀的是專案目錄下的 `dist/index.html`（可用 `DIST_DIR` 指定），所以 `npm run build` 要在 API 執行的那台機器上跑。
- 建議設定 `SITE_URL`（例如 `https://example.com`），預覽圖與連結才會是正確的對外網址。
- 預覽圖是封面原圖，不會套用封面的裁切設定；沒有封面時用網站頭像。
- 文章預覽的描述是「分類 · 閱讀時間 · 日期 · 標籤」，不會顯示內文；專案則顯示簡短介紹。
- 「複製文章連結」「複製專案連結」每次都產生不同的短網址（`/b/<8 碼>` + 3 碼隨機，專案用 `/p/`），打開後導向完整網址。因為每次網址都不同，Discord 等平台每次都會重新抓預覽，不會沿用舊的快取。

## Markdown 暴雷標記

在文章、About 經歷或支援 Markdown 的內容中，用 `||暴雷內容||` 包住要先遮住的文字，裡面可以有粗體、刪除線、`code`、連結或換行。內容會模糊成看不清的樣子，下方有一條點線；點一下或以鍵盤 Enter／空白鍵即可顯示，再操作一次可重新遮住。表格裡的 `|` 是分隔欄位用的，要在表格內使用暴雷請寫成 `\|\|暴雷內容\|\|`。這只是閱讀呈現效果，文字仍會存在公開文章資料中，請勿用它隱藏密碼或真正的機密。

## 彩蛋

所有彩蛋（終端機指令、Google 經典彩蛋、登入頁與詐騙後台、特殊網址、季節效果、成就與通關證書）都整理在 [EASTER_EGGS.md](EASTER_EGGS.md)。

登入表單後面沒有任何 SQL，也不會執行使用者輸入；彩蛋不建立 session、不算登入失敗。詐騙後台 `/panel` 的「PHP 後門」純屬瀏覽器內模擬，檔案不會上傳、儲存或執行，伺服器端也沒有 PHP。選用的 flag 設定放在不納入 Git 的 `data/security-flags.json`（格式見 `server/security-flags.example.json`）。

## 一鍵更新（正式主機）

在專案目錄下執行：

```bash
npm run deploy               # 拉最新程式、npm install、build、重啟 API、更新 nginx 設定並檢查預覽
npm run deploy -- --restart  # 只重啟 API 並更新 nginx 設定（不 pull、不 build）
```

腳本是 `deploy/update.sh`，預設服務名稱為 `baihu-blog-api`、nginx 容器為 `my-dashboard`，可用環境變數 `SERVICE`、`CONTAINER` 覆寫。重啟 systemd 服務需要 sudo。最後會用第一篇文章的短網址檢查 API 與 `SITE_URL` 是否回傳預覽標籤；API 在 30 秒內沒有起來會中止並提示看 `journalctl`。

nginx 設定是用 `docker cp` 放進容器的，容器被重新建立（更新映像檔、`docker run`）後就會消失，再跑一次 `npm run deploy -- --restart` 即可還原。

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
