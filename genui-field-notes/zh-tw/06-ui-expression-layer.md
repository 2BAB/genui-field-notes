# UI 生成時，不同框架的輸出細節比對

前面幾章的重點是各家框架／協定在做什麼，以及一套 GenUI 產品大致如何運作，也提供了一些 Demo。從本章開始，我們再往實作細節走一層。先看 UI 生成階段：同樣輸入一份 Singapore weather snapshot，OpenUI 和 A2UI 在 renderer 前面各自生成了什麼？Vercel 的內容不多，這一章先不納入分析。

OpenUI 天氣 demo 使用 10 個天氣領域元件，由 Gemini 3.5 Flash 生成 OpenUI Lang，再交給 React renderer：

![OpenUI Singapore weather demo](../public/media/openui-weather-singapore.png)

A2UI 天氣 demo 使用 v0.9 Basic Catalog，同樣由 Gemini 3.5 Flash 生成 A2UI messages。伺服器端完成驗證後，再交給 Flutter renderer：

![A2UI Flutter Singapore weather demo](../public/media/a2ui-weather-singapore.png)

兩邊使用同一份固定資料：Singapore、26°C、體感 29°C、濕度 82%、風速 13 km/h，也都保留了真實 Gemini request、raw SSE 和最終輸出。這樣可以直接看兩套生成合約的差異，同時觀察同一個模型面對兩種表達方式時的實際結果；不過，我們刻意讓 OpenUI 在這一輪使用較 semantic 的大型元件，A2UI 則使用較原子化的元件，藉此比較這部分的行為細節。要注意的是，本章的比較方式在變因控制上並不完全嚴謹。

## 生成端會先取得什麼

模型要生成 UI，第一步要先知道自己可以使用哪些元件，以及應該按照什麼格式輸出。

OpenUI 會把 component library 展開成 system prompt。天氣實驗註冊了 `WeatherCanvas`、`WeatherHero`、`MetricGrid`、`HourlyForecast`、`DailyForecast`、`UnitToggle`、`ActionButton` 等 10 個元件，最後生成的 system prompt 約 8,900 個字元，使用 GPT-5 tokenizer 計算為 2,205 tokens。它主要包含四個部分：

1. OpenUI Lang 的語法，例如每一行使用 `identifier = Expression`，`root` 是進入點。
2. 元件的 signature、參數順序和欄位類型。
3. `$unit`、`@Set`、`@ToAssistant`、`Query()` 等狀態、行為和資料規則。
4. 一份完整的天氣 UI few-shot example。

本輪 user message 只有一句 `Show Singapore weather`，外加固定的 weather snapshot。模型根據 system prompt 選擇元件，React 元件的內部版面和樣式仍由應用程式碼決定。

A2UI 先由用戶端宣告自己支援的 catalog：

```json
{
  "a2uiClientCapabilities": {
    "v0.9": {
      "supportedCatalogIds": [
        "https://a2ui.org/specification/v0_9/basic_catalog.json"
      ]
    }
  }
}
```

`catalogId` 是用戶端和 agent 共用的元件字典。用戶端透過它說明「我能呈現哪些元件」；agent 或 generation middleware 再把 protocol schema、catalog 和生成規則整理給模型。A2UI 規定通訊合約，system prompt 則由每個 agent 實作自行組織。

這次 A2UI system prompt 是一份針對天氣 demo 精簡過的生成合約，共 9,466 個字元、2,323 tokens，主要包含四個部分：

1. `createSurface`、`updateDataModel`、`updateComponents` 三則訊息的順序和固定欄位。
2. `Card`、`Column`、`Row`、`Text`、`Icon`、`Divider`、`Button` 七種 Basic Catalog 基礎元件的屬性限制。
3. 元件 ID、引用、資料、四個城市 action，以及窄螢幕每列兩個按鈕的規則。
4. 一份完整的 Tokyo 66-component few-shot example。

一輪 user message 包含一句這次的請求，加上完整的 weather snapshot；demo 中這一輪共 542 個字元、150 tokens。模型生成 JSONL 後，伺服器端會繼續檢查 catalog、訊息順序、資料、元件樹和 action，再把通過驗證的三則訊息交給 A2A。

這兩個起點已經帶出一項工程差異：OpenUI 的生成合約通常會跟著 Web 服務和 component library 一起發布；A2UI 的 catalog 同時受到用戶端版本限制，伺服器端需要先知道目前 Android、iOS 或 Flutter 用戶端能呈現什麼。

## 第一次生成：OpenUI Lang 和 A2UI Messages

OpenUI 回傳的是一段以 `root` 為進入點的 UI 程式。本次真實 Gemini 輸出一共有 17 條 statement，開頭如下：

```text
root = WeatherCanvas([hero, metrics, hourly, daily, advisory, controls])
$unit = "c"
hero = WeatherHero("Singapore", "Singapore", "2026-06-22 20:00 SGT", 26, 29, "Mostly cloudy", "Mostly cloudy and humid...", $unit)
metrics = MetricGrid([humidity, wind, rain, heat])
```

第一行先列出整棵 UI 的主要區塊，後面的 statement 再依序補上 `hero`、`metrics`、`controls`。元件使用位置參數，欄位名稱已經寫在 component signature 裡，模型不必在每次呼叫時重複輸出。

A2UI 回傳的是數則有順序的訊息。為了方便閱讀，下面只保留每則訊息的主要欄位：

```jsonl
{"version":"v0.9","createSurface":{"surfaceId":"weather","catalogId":".../basic_catalog.json"}}
{"version":"v0.9","updateDataModel":{"surfaceId":"weather","path":"/","value":{"city":"Singapore","temperature_c":26}}}
{"version":"v0.9","updateComponents":{"surfaceId":"weather","components":[{"id":"root","component":"Column","children":["heroCard","cityCard"]}]}}
```

`createSurface` 建立一塊可以持續更新的 UI；`updateDataModel` 寫入資料；`updateComponents` 寫入帶有 ID 的元件樹。結構、資料和 Surface 生命週期在協定裡各有自己的位置。

把真實產物壓成沒有多餘空格的形式，再用 OpenUI 官方 benchmark 相同的 `tiktoken.encoding_for_model("gpt-5")` 計算，可以得到下面的數字：

|本機紀錄|字元數|GPT-5 tokenizer|輸出規模|
|:---|---:|---:|:---|
|OpenUI：真實 Gemini Singapore 輸出|1,467|432 tokens|17 statements|
|A2UI：真實 Gemini Singapore 輸出|6,747|1,633 tokens|3 messages，66 components|

兩列都是 Gemini 3.5 Flash 的真實輸出，OpenUI 這一輪少了約 73.5%。A2UI 的 1,633 tokens 裡，`updateComponents` 一則訊息佔 1,482 tokens，主要篇幅都花在 66 個基礎元件的 ID、類型、屬性和引用關係上。

同一組 A2UI 紀錄裡還有一項更直接影響體驗的資料：Singapore 一輪 Gemini generation latency 為 14,057 ms，London action 為 11,977 ms。目前的實作會等完整 JSONL 回傳並通過驗證，再把 A2UI messages 交給用戶端，因此首次 Surface 至少得先等這段模型生成結束，後續還要經過驗證與呈現。這兩個數字只對應本次實作，A2UI 的理論下限仍需另外測量；它們也說明 token efficiency 需要和使用者實際等待的時間放在一起觀察。

OpenUI 官方也把 token efficiency 當作 OpenUI Lang 的主要設計目標。官方 benchmark 使用 GPT-5.2，在 7 個情境裡先生成 OpenUI Lang，再把同一棵 AST 轉成 Vercel JSON-Render 和 Thesys C1 JSON。總計結果是 OpenUI Lang 4,800 tokens、Vercel 10,180 tokens、C1 9,948 tokens，分別減少 52.8% 和 51.7%；單一 contact form 情境最高減少 67.1%。這份官方測試涵蓋 Vercel 和 C1，本章的 A2UI 數字則來自另一組天氣實驗。

OpenUI 在第一次生成時使用較少的輸出 token。這個結果同時來自兩個地方：一是位置參數和引用讓 OpenUI Lang 比 JSON 緊湊；二是本次 OpenUI 使用天氣領域元件，A2UI 使用 Basic Catalog 基礎元件。本輪保留了兩套框架各自更自然的用法，因此測到的是整套輸出合約的成本；若要單獨測量語言格式，還需要再做一組元件粒度相同的實驗。這裡以官方的測試結果（減少約 50%）作為主要參考，我們的 demo 情境沒有嚴格固定 UI 設計，也就是未完整控制變因。

## 元件粒度：模型是在選卡片，還是在排列 Layout

OpenUI 的 `WeatherHero(...)` 已經包含城市、溫度、天氣圖示、體感和摘要。模型呼叫一次，React renderer 再把它展開成完整的 hero 區域。

A2UI Basic Catalog 裡只有 `Card`、`Column`、`Row`、`Text`、`Icon`、`Divider`、`Button` 等基礎元件。同一個 hero 需要逐層寫出 `heroCard`、`heroBody`、`locationRow`、`temperatureRow` 和各個 Text 節點。本次一共使用 66 個 components，其中 `updateComponents` 一則訊息就佔 1,482 tokens。

因此，432 和 1,633 同時反映了 DSL 格式與元件粒度。假如 A2UI catalog 預先提供一個 `WeatherCard`，元件數量和 payload 都會明顯縮小；假如 OpenUI 只開放 `Stack`、`Text`、`Icon` 這些基礎元件，它也需要輸出更多 statements。

元件粒度實際決定了模型參與多少設計。Semantic Component 路線讓模型選擇「使用哪張天氣卡片」；基礎元件路線讓模型繼續決定卡片內部有哪些 Row、Column 和 Text。前者較容易穩定導入，後者保留更多版面編排的自由，也會增加 token、生成驗證和視覺測試的成本。

這次 A2UI 實驗第一次就遇到一個很具體的例子。Gemini 輸出了 70 個 components，協定欄位、元件引用和 action 都能通過驗證，但它把三個城市按鈕排進同一個 Row，Flutter 最後回報右側溢出 65 pixels 的 `RenderFlex overflow`。隨後在 prompt 和 validator 裡同時加入「窄螢幕每列兩個城市按鈕」的規則，第二次輸出收斂為 66 個 components，Singapore 和 London 都能在原生 UI 中正確呈現。

因此，元件樹通過 schema 驗證只是第一道檢查。基礎元件越自由，生成端越需要理解 renderer 的實際尺寸限制；截圖、overflow log 和多尺寸測試也會逐漸成為生成流程的一部分。

## 後續更新：只改資料，還是重新生成 UI

第一次生成的長度只涵蓋了一半問題。UI 顯示後，使用者點選 London，伺服器端取得新的天氣資料，框架是否還要把整棵 UI 再描述一次？

本章記錄的第一輪 A2UI demo 直接把 `"text": "Singapore"` 這類 literal value 寫進元件。點選 London 後，`select_city { city: London }` 會啟動下一輪 Gemini 生成，再傳送 `createSurface + updateDataModel + updateComponents(66)`；這次真實輸出是 1,636 tokens。這一輪先驗證完整的 action round trip，後來完成的 data-bound 版本及 payload、rebuild、state preservation 結果放在下一章。

如果元件已經綁定 Data Model path，完整 London snapshot 的 `updateDataModel` 是 410 個字元、109 tokens；只更新 `/temperature_c` 的訊息是 95 個字元、27 tokens。相較於重新生成 1,636 tokens，這個差距已足以說明重用元件樹後可能省下的輸出成本。

OpenUI 目前 demo 的城市按鈕使用 `@ToAssistant("Show Tokyo weather")`，下一輪會重新輸出完整 UI 程式，共 450 tokens。`Query()` 可以讓 runtime 重新請求資料而不生成版面。這裡先記錄兩條路徑的輸出成本，具體的 binding 機制、Query 生命週期和職責歸屬放到下一章。

## 串流生成：逐行補齊，還是逐則更新

OpenUI 的漸進單位接近文字。實驗把 Singapore fixture 每 37 個字元切成一個 chunk，共 43 個 chunks。第一個片段到達後，parser 已經能根據 `root = WeatherCanvas(...)` 建立外框；暫時缺少的 `hero`、`metrics` 等引用會隨著後續 statement 到達而補齊。最後得到 17 statements、0 unresolved、0 parser errors。

這條路徑的代價也出現在 renderer。瀏覽器的最終畫面正常，但 progressive reconciliation 期間記錄了 36 則 duplicate-key warnings。parser 證明語法和引用能夠收斂，React renderer 還要處理同一棵樹反覆 materialize 時的節點身分。

A2UI 以完整 message 為增量單位。renderer 先處理 `createSurface`，再處理 `updateDataModel` 和 `updateComponents`；元件透過 ID 定位，後續訊息繼續替換資料或元件。它通常需要等待一則 JSON message 閉合後再套用，換來的是更明確的更新邊界。

兩者的 streaming 發生在不同粒度。OpenUI 更在意一輪回應裡能否提早顯示 UI；A2UI 的 message 和 ID 更適合一塊會存活較久，還會由後續訊息更新的 Surface。

## 資料由模型編，還是由業務系統填入

OpenUI + Gemini 的實驗還暴露了一個實際問題。例如，當 user message 提供的資料只有目前天氣：

```json
{
  "city": "Singapore",
  "temperatureC": 26,
  "feelsLikeC": 29,
  "humidity": 82,
  "windKph": 13,
  "rainChance": 70
}
```

system prompt 的 few-shot example 裡同時放了一份 hourly 和 3-day 預報，這讓模型最後輸出了下面兩則合法的 OpenUI Lang：

```text
hourly = HourlyForecast(["20:00", "21:00", "22:00", ...], [26, 26, 26, 25, ...], ["Cloudy", "Shower", ...], $unit)
daily = DailyForecast(["Today", "Tue", "Wed"], [31, 31, 30], [25, 25, 25], ["Thunderstorms", "Showers", "Cloudy"], [70, 65, 45], $unit)
```

本輪 snapshot 的欄位只到 `rainChance`，未來預報取自 few-shot 的示範內容。OpenUI 的 parser 顯示 0 errors，因為欄位類型、元件名稱和引用關係全都正確；也就是說，它能檢查「這是否為合法的 `DailyForecast`」，至於「週二 31°C 是否來自天氣 API」，則不在 parser 判斷資料正確性的範圍內。

A2UI 實驗裡，Python 伺服器端先選擇固定的 `WeatherSnapshot`，再把完整 snapshot 放進 user message。Gemini 負責生成 Data Model 和 component tree；validator 要求 `updateDataModel.value` 與伺服器端 snapshot 的每個欄位一致，因此 Singapore、London 的 Data Model 都能追溯到 mock data source。本章擷取的兩輪 Gemini output 仍使用 literal text props，內容與 snapshot 一致；下一章的 data-bound 版本把 13 個天氣文字改為 `/weather/...` bindings。

產品裡的業務資料通常應該保留可追蹤、可觀測的來源：模型選擇元件和版面，天氣、訂單、庫存等數值由 tool/API 回傳。例如，OpenUI 可以用 `Query()` 把 tool result 串接到元件；A2UI 可以讓 backend 寫入 `updateDataModel`，元件只綁定對應的 path。如此一來，parser/schema 負責 UI 合法性，業務系統繼續負責資料真實性。

## 從產品導入反推選擇

OpenUI 的早期 PMF 更接近 Web 和 chat-like GenUI。團隊可以跟著伺服器端快速更新 component library，用緊湊的語言生成一次性卡片、表單和報表，也可以把 `Query()`、`Mutation()` 留在 Web runtime 裡執行。這條路線要求團隊能控制前端 runtime（本章實驗為 React），並持續觀察 prompt、parser、renderer 和模型輸出品質。

A2UI 更適合已經擁有 native component system 的產品。用戶端實作 catalog，Surface 和 Data Model 可以跨多輪持續存在；伺服器端透過元件 ID 和 data path 更新局部內容。它需要處理 Android、iOS、Flutter/Web 多端元件、catalog version、舊版用戶端和 transport，只有在原生體驗或長生命週期 Surface 確實重要時，這些投入才划算。

至於開頭提到的固定語意元件與原子元件拼組，固定語意元件的成本顯然仍然最低。目前這些 GenUI 協定產生價值的地方，是 UI 結構會隨任務改變，或同一塊 Surface 需要持續接收 agent 更新。快速生成整段新的 Web UI，更接近 OpenUI 目前的產品路線；長期維護一塊可持續更新的多端原生 UI，或許更能發揮 A2UI 的協定設計。


## 參考資料

- [OpenUI Lang Overview @ OpenUI](https://www.openui.com/docs/openui-lang/overview)
- [OpenUI Token Efficiency Benchmarks @ GitHub](https://github.com/thesysdev/openui/tree/main/benchmarks)
- [OpenUI Lang Renderer @ OpenUI](https://www.openui.com/docs/openui-lang/renderer)
- [A2UI Messages @ A2UI](https://a2ui.org/reference/messages/)
- [A2UI Components & Structure @ A2UI](https://a2ui.org/concepts/components/)
- [A2UI Data Flow @ A2UI](https://a2ui.org/concepts/data-flow/)
