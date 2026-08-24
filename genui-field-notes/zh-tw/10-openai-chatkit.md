# OpenAI: ChatKit Widgets

第 5 章介紹 Vercel AI SDK 時，我們提到這是一種很基礎的 `Tool Call` 到預先定義卡片元件的對映：模型先呼叫 `getWeather` 之類的 Tool，前端再用約定好的 `<Weather>` 元件呈現 Tool Result。OpenAI 的 ChatKit **Widgets** 基本上延續了這套做法，兩者的主要差異在 UI 這一層：Vercel 直接使用專案裡的 React 元件，ChatKit 則提供一套固定的 Widget Catalog。

所以，我們可以先把 ChatKit Widgets 歸入同一條 `Tool Call` 對映路線。需要說明的是，ChatKit 本身提供的是聊天產品外層的整合功能，涵蓋 Thread、訊息串流、附件、Action、主題和輸入框等；其中的 **Widgets**，才是本章要討論的預先定義元件 GenUI 路線。

截至 2026 年 8 月，ChatKit 官方建議新專案採用自建伺服器端的 Custom Server Integration：前端嵌入 ChatKit Web Component，後端則使用 ChatKit Python SDK 等方式串接自己的 Agent。ChatKit 先前也能直接串接 Agent Builder 發布的 Hosted Workflow；Agent Builder 目前已進入遷移期，官方預計於 2026 年 11 月 30 日關閉這項服務，ChatKit 本身則會繼續保留。

## 一張 Widget 由誰完成

如前面所述，ChatKit 的頁面很完整，聊天記錄、輸入框和 Widget 卡片都在同一個介面裡。這裡先把一張天氣卡片 Widget 的分工說清楚：

```text
ChatKit Widget Catalog + 開發者 Template + 執行階段 Data
                           ↓
                      最終 Widget
```

| 部分 | OpenAI 提供 | 開發者完成 |
| --- | --- | --- |
| 聊天外殼 | Web Component、Thread、訊息串流、輸入框和附件 | 嵌入頁面、連線至 `/chatkit` 端點、設定主題 |
| Widget | Catalog、預設樣式和瀏覽器 Renderer | 選擇元件，編排卡片結構和文案 |
| Template | `.widget` 格式、Studio、Python `WidgetTemplate` | 編寫範本、Schema、Jinja 資料綁定和條件 |
| 執行階段資料 | Tool Call、Thread stream event | 實作 Tool，串接天氣、訂單等業務資料來源 |
| 互動 | Action 事件、loading 狀態和更新 API | 定義 Action 名稱、參數與伺服器端處理邏輯 |

天氣卡片的實際流程也可以整理成五個步驟：使用者詢問天氣，模型選擇 `show_weather` Tool，Tool 回傳天氣資料，伺服器呼叫 `WidgetTemplate.build(data)`，最後由 ChatKit Renderer 呈現元件樹。模型只需要產生 Tool 名稱和參數；卡片長什麼樣子，則由開發者編寫的 Template 決定。

本章採用 Custom Server Integration。`ChatKitServer.respond()` 接收新訊息，`ChatKitServer.action()` 處理 Widget 上的點選操作；兩個進入點都能向同一個 Thread 寫入串流事件。這個結構把一般回覆、Tool Call、Widget 和後續操作放進同一段聊天記錄。

## 全域主題和單張卡片

開發者可以從兩個位置調整介面。第一層是 ChatKit 的全域 Theme，它會影響聊天外殼和所有 Widget 的基本風格。本次實驗在 `useChatKit()` 中設定暖灰色背景、橘色強調色、圓角、密度和字級：

```ts
theme: {
  density: "spacious",
  colorScheme: "light",
  color: {
    accent: { primary: "#c15f3c", level: 1 },
    surface: { background: "#f7f6f2", foreground: "#eeeae3" }
  },
  radius: "soft",
  typography: { baseSize: 16 }
}
```

第二層是單張卡片的 `.widget` Template。天氣卡片裡的背景、框線、padding、橫向或直向排列、圖示、指標格和按鈕都寫在 Template 中。樣式入口是 Catalog 元件及其 Props，例如 `Row`、`Col`、`Box`、`background`、`minWidth` 和 `wrap`；這些欄位會決定 Renderer 最後採用的版面配置和 Design Token。

為了確認這兩層能自訂到什麼程度，我用同一份天氣資料和 Action 製作了一張 Claude-like 天氣卡片。全域 Theme 負責聊天頁面，Template 負責卡片內部；元件的呈現和互動仍由 ChatKit 完成。

<img src="/media/chatkit-weather-claude-like.jpg" width="420" alt="以 ChatKit Theme 和 Widget Template 製作的 Claude-like 天氣卡片" />

*同一套 ChatKit Components，透過全域 Theme 和 `.widget` Template 調整成 Claude-like 風格。*

這個結果只參考了 Claude 的配色與留白。按鈕狀態、響應式版面配置和元件實作仍然使用 ChatKit。開發者可以調整 Catalog 已開放的欄位，也得接受 Catalog 對元件外觀和樣式範圍的限制。

## Components 和 Widget Template

ChatKit Widgets 公開的元件大致分成四組：

- 根節點：`Card`、`ListView` 和 `Basic`；
- 版面配置：`Row`、`Col`、`Box` 和 `Spacer`；
- 內容：`Text`、`Title`、`Icon`、`Image` 和 `Chart`；
- 輸入與操作：`Button`、`Input`、`Select` 和 `Form`。

伺服器最後交給瀏覽器的是一棵 JSON 元件樹。天氣卡片以 `Card` 作為根節點，再用 `Row`、`Col` 和 `Box` 組織內容。Vercel Demo 會把 Tool Result 交給完整的 React `WeatherCard`；ChatKit Template 則把這些小元件組合成業務卡片。

`.widget` 檔案的外層包含 `version`、`name`、`template`，以及輸入資料的 `jsonSchema`。`template` 是一段帶有 Jinja 運算式的 Widget JSON 字串，例如：

```jinja
{
  "type": "Icon",
  "name": {{ condition_icon | tojson }}
},
{
  "type": "Title",
  "value": {{ city | tojson }}
},
{% for option in cities %}
{
  "type": "Button",
  "label": {{ option | tojson }}
}
{% endfor %}
```

伺服器呼叫 `WidgetTemplate.build(data)` 後，Jinja 會填入變數並處理條件與迴圈，最後得到 `WidgetRoot`。這一步不需要再次呼叫模型。Tool 或應用程式伺服器端負責準備資料，Template 則完成元件樹的組合。

## Studio 範本製作工具

ChatKit Studio 提供 Gallery 和 Builder，協助開發者快速了解並製作 `.widget`。開發者可以從自然語言、mockup、空白檔案或既有的 `.widget` 開始，也能同時查看元件結構、Schema、範例資料、即時預覽和編譯後的 JSON。

![ChatKit Widget Gallery 中的業務卡片、表單和圖表](../public/media/chatkit-widget-gallery.jpg)

*Gallery 透過航班、購物、會議和天氣等業務範例，展示 Catalog 的組合方式。*

本次實驗選擇 Gallery 中的 `weather_current`，再把 San Francisco 改成 Singapore。天氣卡片以 `flex={1}` 平均分配三個指標格，並用 `minWidth` 和 `wrap` 處理較窄的容器。

![在 Widget Builder 中修改 Singapore 天氣卡片](../public/media/chatkit-widget-builder-weather.jpg)

*左側編輯元件、Schema 和範例資料，右側檢查實際呈現結果。*

就我的使用感受，Studio 可以加快 `.widget` 的製作和預覽。Studio 負責匯出檔案，正式環境再由 `WidgetTemplate` 讀取；開發者也能在匯出後繼續修改這個檔案。本章的 Claude-like 版本就是採用這種方式，將原本的藍色主題改成橘色。匯出的 Action 只描述事件名稱、參數和 loading 行為；查詢天氣、更新 Widget 等業務邏輯，仍由應用程式自己的前後端控制（可以設定由前端或後端接收 Action）。

## 開放原始碼的邊界：能確認到哪一步

- ChatKit 的 JavaScript 儲存庫公開了元件 Props、Theme 型別、React Hook 和 Web Component wrapper；
- Python 儲存庫公開了 `ChatKitServer`、Widget schema、Template、Thread event、Widget diff 和 Action runtime。
- 瀏覽器 Renderer 透過 OpenAI CDN 發布，Studio 則以線上工具的形式提供。
- 公開儲存庫目前涵蓋前後端串接層，元件 Renderer 和 Studio 屬於 OpenAI 代管的部分。

本次實驗也檢查了瀏覽器實際下載的 JavaScript 和 CSS，其中包含編譯後的元件註冊表、預設樣式和響應式規則。天氣卡片本身透過 `flex`、`minWidth` 和 `wrap` 配合容器寬度，沒有編寫中斷點運算式；Renderer 外層還會使用 `ResizeObserver` 觀察 Widget 容器，並在 `280`、`355`、`435`、`555`、`755` 和 `955` px 切換響應式規則。因此，元件定義、樣式和寬度規則都有具體值可供核對。這些證據只能用來協助說明頁面的呈現規則；OpenAI 內部原始碼如何組織，目前沒有公開資料。

由於 Renderer 和 Studio 的中間流程沒有公開原始碼，本章不再逐一介紹內部物件和事件名稱，也不根據編譯產物另外推導一套流程說明。感興趣的讀者可以直接試用 [ChatKit Studio](https://widgets.chatkit.studio/) 和 [Widget Gallery](https://widgets.chatkit.studio/gallery)，體驗元件組合、預覽和匯出的完整流程。

## 天氣卡片 Demo

本次實驗使用 `openai-chatkit` 1.6.5、`openai-agents` 0.22.0、`@openai/chatkit` 1.9.0 和 `@openai/chatkit-react` 1.6.1。前端載入 ChatKit Web Component，本機 FastAPI 執行 `ChatKitServer`，Agents SDK 則呼叫真實的 `gpt-5.6`。天氣數值使用固定的 fixture，避免第三方天氣介面影響對 Tool、Widget 和 Action 的觀察。

![ChatKit 中由真實模型觸發的 Singapore 天氣卡片](../public/media/chatkit-weather-singapore.png)

*使用者傳送天氣請求後，模型選擇 `show_weather`，伺服器在同一個 Thread 中推送天氣 Widget。*

使用者輸入 `Show me the weather in Singapore.` 後，模型第一次回傳的結構化結果很短。實驗紀錄經過 Agents SDK 正規化後如下：

```json
{
  "tool": "show_weather",
  "arguments": {
    "city": "Singapore"
  }
}
```

接著，`show_weather` Tool 會從 fixture 中讀取天氣資料：

```json
{
  "city": "Singapore",
  "temperature": "31 C",
  "condition": "Partly cloudy",
  "condition_icon": "lucide:cloud-sun",
  "humidity": "74%",
  "wind": "13 km/h",
  "feels_like": "36 C",
  "observed_at": "10:30 SGT"
}
```

Tool 一面把這份資料交給 `.widget` 範本，一面將結果回傳給模型。範本產生 `Card` 元件樹並寫入 Thread；模型取得 Tool Result 後，又產生一句 `Here’s the current weather in Singapore.`。所以，這一輪實際產生了兩個 OpenAI Response：第一個選擇 Tool，第二個補充自然語言。

從模型開始執行到 `show_weather` Tool Call 共花了 2,169 ms，到完整 Widget 為 2,874 ms，整輪 Response 在 4,429 ms 完成。這段延遲包含真實模型請求，以及本機刻意加入的約 700 ms loading 狀態；資料本身並未透過遠端天氣服務取得。

## 一張 Widget 如何以串流方式出現

`show_weather` Tool 回傳的是一個非同步過程。它先 yield loading Widget，稍等一段時間後再 yield 完整結果：

```python
async def states():
    yield build_loading_weather_widget(city)

    await asyncio.sleep(0.7)
    snapshot = get_weather(city)
    yield build_weather_widget(snapshot)

await ctx.context.stream_widget(states())
```

ChatKit Python SDK 會將兩個 `WidgetRoot` 狀態轉換成 `thread.item.added`、`thread.item.updated` 和 `thread.item.done` 等事件。前端產品程式碼不必另外定義一套天氣卡片 SSE 協定，只要讓 ChatKit Web Component 接收 Thread stream 即可。

實驗中還遇到一個很具體的問題：`Icon.name` 寫成 `cloud-sun` 時，頁面不會顯示圖示。查閱 ChatKit JS 的官方 API Reference 後，可以看到 `LucideIcon` 定義為 ``lucide:${string}``，`ChatKitIcon` 則同時包含 ChatKit 內建名稱和 `LucideIcon`。因此，可以判斷 `cloud-sun` 與 `lucide:cloud-sun` 會進入兩個不同的圖示表。

`.widget` 經過 `WidgetTemplate.build()` 後會轉換成 `DynamicWidgetRoot`。這個型別允許範本帶有額外欄位，建置過程也不會使用 `.widget` 中的 `jsonSchema` 驗證每個圖示名稱，因此 `cloud-sun` 能順利進入瀏覽器。Renderer 收到名稱後才進行分流：沒有前綴的名稱會進入 ChatKit 內建圖示表，帶有 `lucide:` 前綴的名稱則進入 Lucide 圖示表。ChatKit 內建圖示表中沒有 `cloud-sun`，所以第一次呈現時只得到一塊空白；改成 `lucide:cloud-sun` 後，Renderer 找到對應的 Lucide chunk，圖示才正常顯示。

這個問題說明 `.widget` 的 Schema、Python 範本建置和瀏覽器 Renderer 是三道不同的檢查。欄位通過前兩道檢查，只代表 JSON 結構可以繼續傳遞；元件中的列舉值最後仍要由 Renderer 識別。這算是一個能幫大家避開的小問題。

## 元件裡的按鈕如何進行下一步

天氣 Widget 底部有 Singapore、London、Tokyo 和 Refresh 四個按鈕。每個按鈕都帶有一份 `ActionConfig`：

```json
{
  "type": "Button",
  "label": "London",
  "onClickAction": {
    "type": "weather.select_city",
    "handler": "server",
    "payload": {
      "city": "London"
    }
  }
}
```

使用者點選後，ChatKit 會把 Action 傳送給 `ChatKitServer.action()`。這次實驗直接讀取 London fixture，先替換成 loading Widget，約 450 ms 後再替換成 London；Tokyo 和 Refresh 也採用相同的流程。三次 Action 的 `invokes_model` 都是 `false`，Action 前後的模型執行次數維持不變。

伺服器還向 Thread 寫入一筆 `HiddenContextItem`，記錄使用者已經選擇 London。使用者下次傳送訊息時，模型便能從歷史脈絡中讀到這次操作。`action()` 也可以改成呼叫模型或寫入一則新訊息；本次實驗採用的是在本機更新 UI，並補上一筆隱藏脈絡。

## 平台和語言邊界

一方面，由於 Widget 是一般的 JSON，任意後端語言和框架都可以產生相同的元件樹。官方的 `.widget + Jinja + WidgetTemplate` 工具鏈目前放在 Python SDK 中；公開的 Node.js 套件裡，尚未看到對等的範本編譯器和 Custom Server runtime。Node.js 專案通常需要用 TypeScript 函式建構 Widget JSON，或自行串接範本引擎。ChatKit Renderer 最後讀取的是瀏覽器收到的元件樹。

另一方面，用戶端是一套 Web Component。因此，除了瀏覽器之外，其他平台可以嵌入 Web 內容，理論上也能自行實作這份 Widget Catalog 的 Renderer。OpenAI 目前尚未提供類似 A2UI Flutter、AGenUI Android 的原生 Renderer，因此 ChatKit 的用戶端實作仍明顯偏向 Web。

## 一點判斷

個人認為，ChatKit Widgets 最大的參考價值，來自 ChatGPT 長期累積的大量真實使用資料。可以合理推測，OpenAI 能從早期使用情境中判斷聊天視窗需要顯示什麼、使用者經常執行哪些操作，再據此整理出一套相對合理的元件庫。開放式 GenUI 框架自行建立 Catalog 時，參考這份元件庫定義具有實際的產品價值；至少不用從 `Text + Button` 開始測試。

另外，由於 ChatKit Renderer 與 Studio 由 OpenAI 代管發布，官方 Custom Server 工具鏈目前也明顯偏向 Python，後續升級存在幾項具體風險。例如，目前官方頁面直接載入沒有版本號的 `chatkit.js`，也沒有提供固定 Renderer 版本或自行部署的入口；一旦元件參數、響應式中斷點或預設樣式發生變化，已經上線的 Widget，以及重新開啟的歷史 Widget，都得跟著驗證。核心業務長期依賴這套工具，會增加維護和回復舊版本的成本。

反過來看，這套代管方式省去了實作元件、聊天外殼和 Thread runtime 的前期工作，很適合用來快速驗證 Agent Chat 產品是否有人使用，以及 GenUI 的加入能為產品帶來多少價值。

## OpenAI 體系裡的其他 GenUI 相關技術

### MCP Apps

MCP 原本負責串接模型與外部資料、工具；MCP Apps 則在這條流程上加入 UI Resource 和 iframe 通訊協定。MCP Tool 透過 `_meta.ui.resourceUri` 指向開發者預先寫好的 HTML App；在 ChatGPT 中，OpenAI 的 Host 使用 sandbox iframe 載入它，再透過 MCP Apps Bridge 傳入 Tool Input、Tool Result，以及主題、尺寸等資訊。

模型只需要選擇 Tool 並填寫參數，頁面版面配置和互動程式碼都已經寫在 HTML App 中。因此，MCP Apps 更接近「Tool + Web View」：它為 ChatGPT 中的第三方互動介面提供統一的掛載方式，本身並未定義一套讓模型編排元件的 UI 語言。

### Structured Outputs

Structured Outputs 可以用來實作另一種更接近 A2UI 的實驗：開發者先將 `Card`、`Text`、`Button` 等預先定義的元件寫成遞迴 JSON Schema，再讓模型產生符合 Schema 的元件樹，用戶端則依照節點名稱對映到 React 等平台元件。OpenAI 官方 GitHub 範例還會以串流方式接收 Function Arguments，使用 `partial-json` 解析尚未結束的 JSON，逐步顯示已經產生的部分。這裡的元件庫、樣式、Renderer、狀態和 Action 都要由開發者實作；Structured Outputs 主要負責限制模型的輸出結構。它可以作為自建 GenUI 的起點，但相較於 A2UI、OpenUI 這類已經補齊協定和 runtime 的方案，仍有不少工程工作要完成。

## 參考資料

- [ChatKit @ OpenAI](https://developers.openai.com/api/docs/guides/chatkit)
- [Advanced integrations with ChatKit @ OpenAI](https://developers.openai.com/api/docs/guides/custom-chatkit)
- [ChatKit widgets @ OpenAI](https://developers.openai.com/api/docs/guides/chatkit-widgets)
- [Actions in ChatKit @ OpenAI](https://developers.openai.com/api/docs/guides/chatkit-actions)
- [ChatKit Widget Gallery](https://widgets.chatkit.studio/gallery)
- [ChatKit Python SDK @ GitHub](https://github.com/openai/chatkit-python)
- [ChatKit JS SDK @ GitHub](https://github.com/openai/chatkit-js)
- [LucideIcon @ OpenAI ChatKit JS](https://openai.github.io/chatkit-js/api/openai/chatkit/type-aliases/lucideicon/)
- [OpenAI ChatKit Advanced Samples @ GitHub](https://github.com/openai/openai-chatkit-advanced-samples)
- [Agent Builder @ OpenAI](https://developers.openai.com/api/docs/guides/agent-builder)
- [Add UI to your MCP server @ OpenAI](https://developers.openai.com/plugins/build/chatgpt-ui)
- [Structured Outputs @ OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI Structured Outputs Samples @ GitHub](https://github.com/openai/openai-structured-outputs-samples)
