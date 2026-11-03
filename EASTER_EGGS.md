# 彩蛋總覽

網站上所有彩蛋依「觸發方式」整理如下。大多數彩蛋會解鎖成就，成就只存在訪客自己的瀏覽器（localStorage），不會上傳。開啟「減少動態效果」（`prefers-reduced-motion`）時，動畫類彩蛋會改成靜態或略過。

## 終端機

按 `` ` ``、`Ctrl/⌘ + K` 或頁尾的 `>_` 打開終端機（成就「駭客模式」）。支援 Tab 補全、↑↓ 歷史、`Ctrl + L` 清除。

### 一般指令

| 指令 | 效果 |
| --- | --- |
| `help`、`whoami`、`ls`、`cd <頁面>`／`open`、`date`、`echo`、`history`、`clear`、`exit` | 基本指令 |
| `blog`、`read <編號>` | 列出文章、開啟文章 |
| `guestbook` | 打開首頁留言板 |
| `music [play\|pause\|next\|prev]` | 控制背景音樂 |
| `achievements` | 列出成就進度 |
| `fortune` | 隨機籤詩 |
| `certificate` | 前往通關證書頁 |

### 惡搞指令

| 指令 | 效果 | 成就 |
| --- | --- | --- |
| `sudo` | 「visitor is not in the sudoers file」 | 權限不足 |
| `rm -rf /`（也接受 `sudo`、`-rf`／`-fr`／`-r`、`/*`、`--no-preserve-root`） | 一路刪掉系統目錄，然後整個網站崩潰黑屏；重新整理就會復原 | 刪庫跑路 |
| `rm`（其他用法）、`cat flag` | 求饒／提示 flag 在登入頁 | |
| `vim`／`vi`／`nvim` | 進入 vim，Esc 沒用，要 `:q!` 才出得來 | 逃出 vim |
| `emacs` | 「請先安裝一個作業系統」 | |
| `matrix` | 數位雨 | 紅藥丸 |
| `hack`、`coffee`／`brew` | 假駭客進度條、HTTP 418 | |
| `prompt`、`show me your prompt`、`talk is cheap` | 「Code is cheap. Show me your prompt.」並「洩漏」網站假系統提示詞 | Show me your prompt |
| `rickroll`、`never gonna give you up` | 新分頁開啟官方 MV | Never gonna give you up |
| `padoru` | 狐狸拉雪橇飛過 | PADORU PADORU |
| `newyear`、`恭喜發財`、`新年快樂` | 紅包雨與「恭喜你發財 恭喜你精彩」 | 恭喜你發財 |
| `make me a sandwich`／`sudo make me a sandwich` | xkcd 149 | |
| `42`、`answer to life the universe and everything` | 42 | |

### Google 經典彩蛋

| 指令 | 效果 | 成就 |
| --- | --- | --- |
| `67`、`6-7`、`six seven` | 整個頁面上下左右劇烈搖晃 | 6 7 |
| `do a barrel roll`、`barrel roll` | 網站轉一圈 | Do a barrel roll |
| `askew` | 網站歪掉 | |
| `tableflip`／`unflip` | 翻桌／把桌子放回去 | |
| `thanos`／`snap` | 一半卡片化為灰燼後復原 | 無可避免 |
| `gravity` | 卡片掉到底部 | 牛頓 |
| `blink` | 1996 年風格閃爍 | |
| `recursion`、`anagram` | 「你是不是要找…」 | |
| `flip a coin`／`擲硬幣`、`roll a die`／`擲骰子` | 擲硬幣、擲骰子 | |
| `loneliest number` | 1 | |
| `game of life`／`life` | Conway 生命遊戲 | 生命遊戲 |
| `dino`／`t-rex` | 狐狸跑酷（斷線時也會自動出現） | 離線也要玩 |
| `zerg rush`／`zerg` | 30 個 o 衝進來吃卡片，每個點三下 | Zerg Rush |
| `sus`／`impostor` | Among Us 彈射畫面 | sus |
| `nyan` | 彩虹狐狸飛過 | Nyan 狐 |

### 終端機小遊戲

| 指令 | 玩法 | 成就 |
| --- | --- | --- |
| `snake` | 方向鍵或 WASD，Esc／q 離開 | 貪食蛇（吃到 10 顆） |
| `hackertyper`／`hacker` | 亂按鍵盤打出假駭客程式碼，連按 3 次 Alt 出現 ACCESS GRANTED，Esc 離開 | ACCESS GRANTED |

## 在網頁上直接打字

不用打開終端機，在頁面上（非輸入框）直接用鍵盤打：

| 輸入 | 效果 | 成就 |
| --- | --- | --- |
| ↑↑↓↓←→←→BA（Konami Code） | 狐狸櫻花雨 | 老玩家 |
| `fox` | 狐狸跑過畫面 | 狐狸快跑 |
| `67` | 頁面劇烈搖晃 | 6 7 |
| `sus` | Among Us | sus |
| `nyan` | Nyan 狐 | Nyan 狐 |

## 點擊與操作

| 操作 | 效果 | 成就 |
| --- | --- | --- |
| 連點頭像 10 次 | 頭像反應 | 頭像粉絲 |
| 連點網站名稱 7 次 | Android 風格「再點 N 次即可成為開發人員」，最後打開終端機 | 開發人員模式 |
| 切到別的分頁 | 標題變成「🦊 你去哪了？快回來～」，回來時「🦊 歡迎回來！」 | |
| 閒置 90 秒 | DVD 螢幕保護程式，撞牆變色；撞進角落放煙火 | 正中角落（加分） |
| 播放音樂 | | DJ |

## 開發者工具

- 頁面原始碼（`index.html`）註解：「Code is cheap. Show me your prompt.」
- Console 有給開發者的訊息；輸入 `play()` 開始文字冒險，之後用 `look`、`north`、`south`、`east`、`west`、`take`、`give`、`inventory`、`help`（不用加括號）。在竹林撿起油豆腐，帶到神社交給 baihu 即可通關（成就「文字冒險家」）。
- `robots.txt` 裡有一隻狐狸。

## 登入頁 `/login`

登入表單後面沒有任何 SQL，也不會執行使用者輸入；伺服器先以固定時間比對正式管理員帳密，不符合時才比對彩蛋。彩蛋不建立 session、不算登入失敗，並有獨立限流（每 IP 每分鐘 20 次）。

| 輸入 | 效果 | 成就 |
| --- | --- | --- |
| SQL 注入字串（`' OR 1=1 --`、`admin' --`、`UNION SELECT` 等） | 假「資料庫傾印」，最後揭曉根本沒有資料庫，並附 xkcd 327《Exploits of a Mom》（Randall Munroe，CC BY-NC 2.5）；有設定 flag 時會一併顯示 | Bobby Tables |
| `admin` / `admin123` | 進入諷刺詐騙集團後台 `/panel` | 打詐英雄 |

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

## 詐騙後台 `/panel`

- 所有資料都在瀏覽器隨機產生，手機號碼皆遮罩、非真實資料。
- 每個按鈕都會跳出反詐騙說明；一段時間後畫面會被「165 反詐騙」接管。
- 「下载受害者名单.zip」是 Rick Roll。
- **模擬 PHP 後門**：在「上传模板」上傳含 `<?php` 的檔案會開啟模擬 webshell（可 `ls`、`cat`、`rm -rf` 等，成就「後門專家」）。檔案只在瀏覽器內讀取，**不會上傳、儲存或執行**，伺服器端也沒有任何 PHP。

## 特殊網址

| 網址 | 效果 | 成就 |
| --- | --- | --- |
| 掃描器常探測的路徑：`/wp-admin`、`/wp-login.php`、`/phpmyadmin`、`/.env`、`/xmlrpc.php`、`/admin.php`、`/administrator`、`/.git`、`/config.php` | 嘲諷蜜罐頁；`/.env` 的「免費領取真正的 flag」是 Rick Roll | 掃描器 |
| 其他不存在的網址 | 迷路狐狸 404，並猜你想去哪一頁 | 迷路了 |
| `/certificate` | 通關證書（見下方） | |

## 季節與日期

| 時間 | 效果 |
| --- | --- |
| 12 月 1–25 日 | 首頁狐狸拉雪橇「PADORU PADORU!」 |
| 農曆正月初一到十五 | 首頁紅包雨與「恭喜你發財 恭喜你精彩」（以瀏覽器農曆計算） |
| 4 月 1 日 | 全站 Comic Sans、標題倒過來，頁尾「今天寫的都是真的 🤥」 |
| 凌晨 0–5 點造訪 | 成就「夜貓子」（加分） |

季節效果每個分頁工作階段播放一次，終端機的 `padoru`、`newyear` 隨時可看。

## 招呼語提醒

在留言板或終端機只輸入「特選」「你好」這類單純招呼語（含 hi、安安、在嗎、請問、學長好等）會被擋下並回覆：

> 不要私訊我只傳個「特選」、「你好」
> 這樣真的有夠沒禮貌，免費的服務不是被拿來踐踏的！
> （外面幫別人健檢都可以收1000以上，拜託拿出你們的禮貌）

加上實際內容即可正常留言。

## 一般成就

不屬於彩蛋、正常瀏覽就會解鎖的成就：初次見面（第一次造訪）、讀者（讀完一篇文章）、書蟲（讀三篇）、有感而發（按表情回應）、留下足跡（留言）、探險家（逛遍首頁、About、Projects、Blog、Friends）。

## 全成就與通關證書

共 41 個成就，其中「夜貓子」與「正中角落」是加分成就，不列入通關條件。解鎖其餘全部成就後會放煙火、跳出橫幅，並解鎖「全成就達成」；到 `/certificate` 輸入名字即可下載通關證書 PNG。未完成時該頁會顯示進度條。
