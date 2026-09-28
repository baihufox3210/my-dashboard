# Baihu Blog

給自己使用的個人 Blog，包含文章、個人首頁、友站與管理後台。

## 本機啟動

在 `.env` 設定管理員帳號與密碼：

```env
ADMIN_USERNAME=your-name
ADMIN_PASSWORD=your-password
```

安裝依賴並啟動前後端：

```bash
npm install
npm run dev
```

管理後台位於 `#admin`。正式版可用 `npm run build` 建置。
