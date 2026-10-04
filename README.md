# Baihu Blog

給自己使用的個人 Blog，包含文章、個人首頁、友站與管理後台。

## 本機啟動

在 `.env` 設定管理員帳號與密碼：

```env
ADMIN_USERNAME=your-name
ADMIN_PASSWORD=your-password
```

流量地區統計僅接受可信任反向代理傳入的 `CF-IPCountry`／`CF-Region` 或 `X-Geo-Country`／`X-Geo-Region` 標頭。正式環境需在 `.env` 設定 `TRUSTED_PROXY_IP` 為反向代理連線到 API 時的來源 IP，並由代理提供地區標頭；伺服器只保存每日地區瀏覽彙總，不保存訪客 IP、IP 雜湊或精確位置，也不會把 IP 傳送至第三方查詢服務。

安裝依賴並啟動前後端：

```bash
npm install
npm run dev
```

管理後台位於 `/admin`。正式版可用 `npm run build` 建置。

## 隔離式 SQL 挑戰

SQL 登入挑戰整合在 `/login` 的「SQL 安全挑戰」模式，只使用每次請求建立的 SQLite 記憶體資料庫與假帳號；成功只回傳 flag，不會呼叫正式登入、不建立管理員 session，也不會讀取或修改正式資料。請勿把這個 SQL 注入查詢移入正式登入或其他資料查詢。

旗標設定存放在不納入 Git 的 `data/security-flags.json`。可從 `server/security-flags.example.json` 複製範本後自行設定：將 `enabled` 設為 `true` 開啟挑戰，並將 `flag` 換成自己的值。設定檔缺失或格式錯誤時，挑戰會安全地維持關閉。請勿把真實 flag 放入範例檔、程式碼或前端；設定檔只由伺服器讀取，不會被靜態網站提供。
