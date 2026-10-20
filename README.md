# Baihu 個人網站

以個人介紹、作品集與 Blog 為核心的網站，包含內容管理後台、音樂播放器，以及以彙總方式保存的流量分析。

## 功能

- 首頁、關於、Projects、Blog 與 Friends 頁面。
- 後台可管理個人介紹、網站設定、Projects、Friends、音樂與流量分析。
- Blog 與 Projects 支援 Markdown、封面圖片位置調整；Projects 可附加 PDF。
- 管理員可上傳及排序 MP3；播放狀態由全站播放器維持。
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

伺服器首次啟動時會建立 `data/` 與必要的預設資料檔。文章、Projects、Friends、音樂清單、網站設定與管理活動紀錄存放於 `data/`；分析資料使用 SQLite；上傳圖片、PDF 與 MP3 存放於 `public/uploads/`。

這些執行期資料與上傳檔案不會提交到 Git。部署或搬遷時，請另外備份並安全地轉移需要保留的 `data/` 與 `public/uploads/` 內容；不要把管理員 session、旗標或其他私密設定公開。

## Markdown 暴雷標記

在文章、About 經歷或支援 Markdown 的內容中，用 `||暴雷內容||` 包住要先遮住的文字。預覽會以點狀圖樣遮住內容；點一下或以鍵盤 Enter／空白鍵即可顯示，再操作一次可重新遮住。這只是閱讀呈現效果，文字仍會存在公開文章資料中，請勿用它隱藏密碼或真正的機密。

## 隔離式 SQL 登入挑戰

挑戰直接使用 `/login` 的一般登入表單。伺服器先以嚴格字串比對驗證正式管理員帳密；只有不符合時，才會將符合長度限制的輸入交給每次請求建立的 SQLite 記憶體資料庫與假帳號。挑戰成功只回傳 flag、不建立管理員 session，也不會連接或修改正式資料；其他不正確輸入仍是登入失敗。挑戰輸入與登入嘗試皆有限流。

旗標設定放在不納入 Git 的 `data/security-flags.json`。可參考 `server/security-flags.example.json`，自行建立以下設定並替換 flag：

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

設定檔缺失或格式錯誤時，挑戰會維持停用。真實 flag 只能放在伺服器端設定，不要放入前端、範例檔或 Git。Vite 開發伺服器會拒絕讀取此設定檔；正式部署也應只公開建置後的 `dist/` 與必要上傳內容，不要將專案根目錄或 `data/` 設為靜態網站根目錄。

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

如需地區彙總統計，請只信任實際連線到 API 的反向代理：設定 `TRUSTED_PROXY_IP`，並由該代理提供 `CF-IPCountry`／`CF-Region` 或 `X-Geo-Country`／`X-Geo-Region` 標頭。伺服器不會保存來源 IP，也不會呼叫第三方 IP 查詢服務。`SITE_START_DATE` 可設定網站啟用日期；未設定時會以伺服器啟動時間作為預設值。`DATA_DIR` 與 `UPLOADS_DIR` 可改變資料與上傳檔的存放位置（預設為 `data/` 與 `public/uploads/`）。
