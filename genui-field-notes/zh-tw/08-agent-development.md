# Agent 開發裡的 GenUI：UI 如何進入一次 Run

承接前兩章再往深處走一步，問題會進到 Agent runtime：這段 UI 如何成為一次 Agent 執行的一部分？使用者點選按鈕後，系統又如何帶著前面的上下文繼續？

本章沿著一次完整的 Run 來看。OpenUI 和 A2UI 仍然是主要比較對象，Vercel AI SDK 則作為一條輕量的實作參照。

## 從 Thread 到 Run

在 chat-like 產品裡，Thread 是一段持續存在的對話，Run（名詞）則是其中一次有起點、有過程、有終點的 Agent 執行。使用者傳送訊息可以開始一次 Run；生成 UI 裡的按鈕、表單送出或 approval，也可以開始下一次 Run。

AG-UI 把這個邊界定義得很直接。`RunAgentInput` 裡包含 `threadId`、`runId`、`state`、`messages`、`tools`、`context` 和 `forwardedProps`；事件串流從 `RUN_STARTED` 開始，以 `RUN_FINISHED` 或 `RUN_ERROR` 結束。中間可以穿插 text、tool call、state 和 activity events。

把它簡化成一條線，大致是：

```text
Thread
  -> Run #1: user message -> model / tools -> generated UI -> finish
  -> user interacts with the UI
  -> Run #2: action + thread context -> model / tools -> UI update -> finish
```

Run 和 transport 是兩回事。AG-UI 可以採用 SSE、WebSocket 或其他傳輸方式；A2UI messages 可以放進 A2A `DataPart`，也可以由 AG-UI middleware 放進 event stream。我們的 Flutter 天氣實驗採用 A2A + A2UI，本章稍後提到的 `ACTIVITY_SNAPSHOT` 和 recovery loop 則來自 AG-UI / CopilotKit 的上游實作。

## 一次 Run 從什麼開始

模型在 Run 開始時需要兩類資訊：任務上下文，以及目前用戶端可以承接的 UI 能力。幾種方案對這兩類輸入的組織方式不同。

OpenUI 的 `ChatProvider` 管理 thread、messages 和 streaming state。呼叫 `processMessage()` 後，它把 `threadId` 和目前的 messages 傳給後端，再由 stream adapter 把 AG-UI、OpenAI Responses 或自訂後端的輸出轉成統一訊息。真正呼叫模型時，伺服器端還要加入 component library 生成的 OpenUI Lang 合約，以及本輪可以使用的 tools。

A2UI 把重點放在 UI payload，Agent Run 的輸入由 A2A、AG-UI 或具體 runtime 組織。採用 A2A 時，Flutter 用戶端會把 `supportedCatalogIds` 放進 request metadata，伺服器端據此回傳用戶端能呈現的 A2UI messages；採用 AG-UI / CopilotKit 時，catalog capabilities、component schema 和 generation guidelines 會進入 `RunAgentInput.context`，middleware 還可以注入 `render_a2ui` tool。Agent 因此同時取得對話上下文和用戶端的 UI 邊界。

Vercel AI SDK 的路徑更短。瀏覽器先產生 `UIMessage`，`createAgentUIStream` 驗證歷史訊息，再把它轉換成模型使用的 `ModelMessage`。tool definition 跟著 model request 一起進入 Run，模型選擇 tool，應用程式再把對應的 typed tool part 映射到 React 元件。

實際上，這一步決定了模型要做什麼：OpenUI 給模型的是語言規則和 component signatures；A2UI 給模型的是 catalog/schema；Vercel 的常見做法則給模型一組 tools。UI 的自由度在 Run 開始前就已經由這些輸入劃定。

## UI 在 Run 中如何回傳

OpenUI 把生成結果放在 assistant message 的 content 裡。模型逐段輸出 OpenUI Lang，前端 adapter 累積文字，streaming parser 在 statement 閉合後更新 AST，React renderer 再把元件呼叫映射成應用程式註冊的元件。`ChatProvider` 會用同一個 message ID 持續更新目前的 assistant message，所以一段尚未完成的 UI 可以在 Run 結束前逐步出現。

A2UI messages 是另一層 payload。採用 A2A 時，一組 `createSurface`、`updateDataModel`、`updateComponents` 會裝進 `application/a2ui+json` 的 `DataPart`，用戶端依序交給 `SurfaceController`。採用 AG-UI middleware 時，A2UI Surface 會成為一則 `ACTIVITY_SNAPSHOT`：同一個穩定的 `messageId` 先承載 `building` 或 `retrying`，通過驗證後再替換成最終的 `a2ui_operations`。這樣一來，Agent Run 的 loading、修復和最終 Surface 都會落在同一個 activity 位置上。

Vercel AI SDK 則把 text、reasoning、tool input、tool output 和 custom data 轉成 `UIMessageChunk`。`useChat` 會增量合併這些 chunks，React 根據 `tool-weather` 這類 typed part 選擇預先寫好的元件。它處理的是 Agent stream 與前端狀態的銜接，卡片內部的 UI 結構仍然來自應用程式碼。

三條路徑的共同點很清楚：生成 UI 需要成為 Run 的一種可辨識輸出，前端還需要穩定的 message 或 activity identity，才能把 streaming 過程合併到正確的位置。

## 使用者動作如何進入下一次 Run

UI 裡的本機切換可以留在 runtime，業務 API 也可以直接執行。這裡關心第三類動作：使用者希望 Agent 繼續理解意圖、呼叫工具或重新組織 UI。

OpenUI 的 `@ToAssistant(...)` 會觸發 `ContinueConversation`。事件裡包含 `humanFriendlyMessage`，還可以帶上 `formState` 和 `formName`。Host 收到後呼叫 `processMessage()`，把它作為新訊息送進同一個 Thread，下一次 Run 就此開始。天氣實驗裡的「Show Tokyo weather」就採用這條路徑。

A2UI action 會帶上 `surfaceId`、`sourceComponentId`、action name 和 context。A2UI 只定義這份 client event，Host 決定後續執行方式。我們的 Flutter 實驗把 `select_city` 當作 A2A data part 傳回 Python 伺服器；CopilotKit 的 React bridge 則把它放進 `forwardedProps.a2uiAction`，接著呼叫 `runAgent()`。AG-UI 的 A2UI middleware 會把 action 整理成 synthetic assistant/tool messages，讓 Agent 在歷史紀錄裡看到這次 UI 互動。

```text
Run #1 output
  -> OpenUI message / A2UI Surface
  -> user action
  -> action payload + Thread context
  -> Run #2 input
```

這裡的關聯資訊需要保留 UI identity。OpenUI 需要知道動作來自哪一則 assistant message 和哪一份 form state；A2UI 透過 Surface 和 component ID 定位來源；Agent runtime 則用 `threadId`、`runId`、tool call ID 或 action ID 串起前後兩輪。缺少這些 ID 時，紀錄裡只能看到「按鈕被點了」和「模型又執行一次」，很難解釋兩者之間發生了什麼。

## 確認、核准與 Run 的暫停

高風險動作通常會把一次執行拆成兩次 Run。第一輪 Agent 提議寄出電子郵件或送出訂單，前端顯示 confirmation / approval UI；使用者確認後，第二輪才真正執行 tool。

AG-UI 的 interrupt lifecycle 提供一個較完整的表達方式：Run #1 以 `RUN_FINISHED` 結束，`outcome.type` 為 `interrupt`，其中包含 `interruptId`、提示文字、可選的 `toolCallId` 和 `responseSchema`。使用者作出選擇後，用戶端在同一個 Thread 裡開始 Run #2，並把結果放進 `RunAgentInput.resume[]`。若需要恢復狀態，Agent 應在第一次 Run 結束前傳送 `STATE_SNAPSHOT` 和 `MESSAGES_SNAPSHOT`。

A2UI 可以負責呈現這張確認卡片和收集結構化輸入，interrupt / resume 的執行語意則來自外圍 Agent protocol。OpenUI 也可以生成 confirmation form，再由 Host 把結果交給自己的 Agent runtime。Vercel AI SDK 提供 tool execution approval；目前天氣實驗只涵蓋一般 tool flow，這條路徑留待後續驗證。

這樣拆開後，介面負責呈現與收集，Agent runtime 負責暫停、關聯、恢復和稽核。一次點選是否已經執行真實業務，也能從 Run 的狀態判斷出來。

## 失敗發生在哪一層

GenUI 進入 Agent Run 後，錯誤大致分成三層。

第一層是生成合約。OpenUI parser 可以回報語法、元件和參數錯誤；A2UI generation 需要檢查 message schema、catalog、component reference 和 data。AG-UI 上游的 A2UI toolkit 實作了一條 validate -> retry 路徑：預設最多嘗試三次，把上一輪的結構化錯誤附加到 prompt，通過驗證的 operations 才會進入 renderer。這個行為來自上游 toolkit 原始碼和測試；目前 Flutter 天氣實驗使用自己的 validator，串接這條 recovery loop 是下一步驗證。

第二層是 Run 和 transport。`RUN_ERROR`、逾時、取消、SSE 斷線、重複 action 都需要關聯到明確的 `runId`。涉及 approval 時，還要檢查 resume 是否屬於同一個 Thread、`interruptId` 是否有效，以及重複送出是否具備冪等性。

第三層是最終呈現和業務執行。A2UI 天氣實驗第一次生成的 70 個 components 可以通過協定驗證，Flutter 仍然出現 65 pixels 的 overflow；OpenUI 的 Query 或 Mutation 也可能在 runtime 遇到網路、權限或業務錯誤。schema 可以檢查結構；實際結果還要透過螢幕截圖、layout log、tool result 和業務狀態來確認。

## 一次 Run 應該留下什麼

若要讓整個流程具備可觀測性，並方便追查問題，一次 GenUI Run 至少需要留下這些紀錄：

1. `threadId`、`runId`、觸發來源，以及前一輪 Run 或 action 的關聯 ID。
2. 傳給 Agent 的 messages、state、tools、catalog/schema 和 client capabilities。
3. model output、tool call / result、原始 UI payload，以及 parser / validator 的結果。
4. 傳給用戶端的 stream events、message/activity ID 和最終 Surface 版本。
5. renderer error、螢幕截圖、使用者 action payload，以及下一次 Run 的入口。

Vercel 天氣實驗把 Browser、API、model、tool、UI stream 和 raw SSE 分開記錄；A2UI 天氣實驗保留 A2A request、A2UI messages、Flutter log 和兩輪螢幕截圖。這種記錄方式比只儲存最終畫面更有用，就像前面兩章提到的：UI 既是本輪 Run 的輸出、Thread 中一段可恢復的紀錄，也是下一輪 Run 的輸入入口。

## 參考資料

- [Core architecture @ AG-UI](https://docs.ag-ui.com/concepts/architecture)
- [Events @ AG-UI](https://docs.ag-ui.com/concepts/events)
- [Interrupts @ AG-UI](https://docs.ag-ui.com/concepts/interrupts)
- [A2UI Transports @ A2UI](https://a2ui.org/concepts/transports/)
- [OpenUI React Headless @ GitHub](https://github.com/thesysdev/openui/tree/main/packages/react-headless)
- [Generative User Interfaces @ Vercel AI SDK](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces)
