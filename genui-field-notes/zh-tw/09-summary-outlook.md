# Chat-like GenUI 的階段性總結與展望

## 本章聚焦 Chat-like GenUI

這本小冊調查的方案和 demo，大多圍繞同一種形態展開：使用者送出一則訊息，系統在對話裡回傳一張卡片、表單、清單或報表，使用者再透過按鈕和 follow-up action 繼續操作。因此，本章的結論僅涵蓋 chat-like GenUI 的方案。

這個範圍適合先做實驗。一段 response 裡的元件數量、狀態範圍和生命週期相對有限，產品可以預先準備 catalog、component library、tools 和 action policy，再逐步增加模型參與的部分。

## 目前看到的三種做法

Vercel AI SDK UI 讓模型選擇 tool，tool result 進入統一的 UI message stream，前端再把 typed tool part 映射到 Semantic Component。它很容易與現有的 React chat 和後端 tools 串接，介面結構主要由產品程式碼控制。

OpenUI / C1 讓模型直接產生一段 UI program。模型可以在 component library 中組合更豐富的結構，Web runtime 繼續處理 parser、state、action、Query 和 Mutation。它適合觀察一輪對話裡，UI 的表達自由度可以走到哪裡。

A2UI 把 catalog、Surface、Data Model、component 和 action 整理成跨平台協定，再透過 A2A、AG-UI 或其他 transport 連接 Agent 與用戶端。它更關注一塊 UI 如何被不同用戶端理解、持續更新，並把互動送回 Agent。

## 目前能確認的幾件事

第一，元件集合仍然是產品邊界。模型可以選擇元件、安排版面或產生 tool input，最終能顯示什麼、能執行什麼，仍由 catalog、component library 和業務 tools 決定。

第二，產生和執行要分開測試。合法的 DSL 或 JSON 只能證明結構能夠解析；真實產品還要檢查版面、資料來源、狀態還原、action、權限和錯誤狀態。

第三，資料應保留可信來源。天氣、訂單、庫存和價格適合由 tool / API 回傳，模型負責選擇呈現方式。這樣才容易分開追查生成錯誤和業務資料錯誤。

第四，一張 UI 能否自然進入下一次 Run，決定了它在對話裡是否真的可用。message / Surface identity、action payload、Thread history、approval 和日誌，都是這段 chat 體驗的一部分。

第五，GenUI 擴大了產品的信任邊界。外部內容可能帶有 prompt injection，用戶端 action payload 可能遭到偽造，catalog 或 component source 也可能被植入惡意內容。產生結果和互動輸入都應視為不可信資料，catalog 管理、伺服器端授權和業務驗證仍由產品系統負責；這些風險尚未納入本冊實驗。

## 從聊天框繼續往外走

Chat-like GenUI 已經把表達層、runtime 和 Agent Run 串接起來。往 general GenUI 延伸時，問題會轉向長期狀態、導覽、多頁面或多 Surface 協作、用戶端版本、權限，以及更完整的測試和復原機制。Google dynamic view 這類實驗展示了更自由的方向，目前仍有不少工程問題需要繼續驗證。


## 參考資料

- [OpenUI](https://www.openui.com/docs/openui-lang)
- [A2UI](https://a2ui.org/)
- [AG-UI](https://docs.ag-ui.com/)
- [Vercel AI SDK: Generative User Interfaces](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces)
