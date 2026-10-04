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

管理後台位於 `#admin`。正式版可用 `npm run build` 建置。
