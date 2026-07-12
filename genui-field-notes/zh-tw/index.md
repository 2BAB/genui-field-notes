# 簡介

聊天訊息裡出現的一張精緻卡片、模型生成一段 JSON 傳給用戶端渲染、頁面根據使用者輸入重新組織版面或調整主題，如今都可能被歸到同一個詞底下：Generative User Interface, aka GenUI。

實際上，對工程師來說，把範圍收斂到技術層面會更容易理解：端側 UI 如何根據意圖、狀態、工具、資料和回饋，動態生成、調整或組裝介面。從這個角度看，GenUI 涵蓋大家日常使用的 Web 頁面與各類 App，也包括正在嘗試即時生成的遊戲等實驗。

這本小冊會沿著幾個可以觀察的早期實踐展開：OpenUI/Thesys C1、Google A2UI、Vercel 的實踐，以及表達層、runtime 和 Agent 開發裡的具體問題。所有內容只圍繞階段性的產業觀察展開，我更關心哪些差異已經看得見，哪些問題值得繼續測試。我不會嘗試全面涵蓋，像是 Coding Agent 生成產品原型（不直接進入正式環境）以及遊戲（極具實驗性），都不在本冊的討論範圍內。

## 版權聲明

1. *個人創作*的內容，均遵守**[姓名標示-非商業性 4.0 國際 (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/deed.zh-hant)**授權條款。
2. 各章結尾完整的*連結引用*均以 `標題加作者` 格式嵌入連結，少量的*內容引用*則在上下文中以簡單的*Markdown 連結引用*格式附上原文連結。
3. 任何形式的引用都會盡量減少對原文的修改，保留原本語意。
4. 引用內容主要來自 OpenUI、A2UI、Thesys C1、Vercel AI SDK 等相關官方說明、GitHub Repo、Demo、技術文章和產品實驗。

## 關於

小冊持續更新中 🚧...目前版本號↓

![GitHub tag](https://img.shields.io/github/v/tag/2BAB/genui-field-notes.svg?sort=semver)

鼓勵大家把 AI 多用在前期的發現與探索、Demo 實驗和技術討論；小冊本身的核心想法仍由作者整理與撰寫。想參與小冊編輯，請前往 GenUI Field Notes 的 [GitHub Repo](https://github.com/2BAB/genui-field-notes)。其他相關問題，歡迎[聯絡我](https://2bab.me/about)。

## 貢獻者名單

<a href="https://github.com/2BAB/genui-field-notes/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=2BAB/genui-field-notes" />
</a>
