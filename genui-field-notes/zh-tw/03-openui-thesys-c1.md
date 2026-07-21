# OpenUI 與 Thesys C1

Thesys 是一家位於 SF 的新創公司，官網將自己定位為 [The Generative UI Company](https://www.thesys.dev/)。業務主要圍繞 UI 生成、Reports API、Agent Builder 和 OpenUI Cloud。它很值得放在這裡觀察，因為它同時提供商用產品和底層的開放原始碼 UI 框架兩條線索。

## 目前的商用產品 C1

C1 是 Thesys 商用產品線裡的 GenUI API & Components。依照官方說明中的流程圖，後端以 OpenAI-compatible API 格式呼叫 C1 的服務，取得一段 C1 Response，再交給前端的 `<C1Component>` 或 `<C1Chat>` 渲染成可互動 UI。

![Thesys C1 conversation flow](../public/media/thesys-c1-conversation-flow.png)

他們採用的是類似中介轉送的模式。[定價模式](https://www.thesys.dev/pricing)也印證了這一點：一套獨立的 C1 用量方案，加上明列的「御三家」模型作為實際執行的 LLM，模型價格特別標示 "no markups"（依 LLM Provider 原價計費，不另外加價），其餘模型則經由 OpenRouter 串接。

下圖黑色區域的 `thesys-agent` 是在 Thesys Console 裡建立的 demo widget，可以嵌入其他客戶的頁面，也是目前主推的產品形態（也就是 chat-like products）。

![Thesys C1 embed demo](../public/media/thesys-agent.webp)

從 Console 端來看，C1 除了模型 API，還提供一層供業務端設定 agent 的產品介面。這個介面可以設定資料來源、視覺 preset、應用程式名稱、描述、版面和 conversation starters，並在右側即時預覽生成的互動介面。

![Thesys C1 Console data panel](../public/media/c1-console-data.png)

![Thesys C1 Console style panel](../public/media/c1-console-style.png)

![Thesys C1 Console settings panel](../public/media/c1-console-settings.png)


## OpenUI 的出現

從公開發布時間來看，OpenUI 是 Thesys 後來開放原始碼的表達層與 runtime。官方文件把它分成 Library、Prompt Generator、Parser、Renderer 幾個部分：應用程式先定義元件庫，生成 system prompt，模型輸出 OpenUI Lang，再由 parser 和 renderer 渲染成 React UI。OpenUI 和 C1 有明顯的上下游關係：

![Thesys Docs OpenUI Support](../public/media/thesys-docs-openui-support.png)

![OpenUI Token Count Results](../public/media/openui-token-count-results.png)

從兩張官網截圖可以看出，C1 早期使用 JSON 作為輸出格式；OpenUI Lang 出現後，官方宣稱生成速度最高提高 3 倍，token 使用量最多減少 66%。根據 [C1 的 API Changelog](https://docs.thesys.dev/api-reference/model-changelog)，從 `v-20260331` 版本起，C1 的回應格式切換為 OpenUI，且不向後相容，舊版本與舊 thread 仍使用 JSON。順帶一提，Thesys Console 目前已將 C1 標示為「OpenUI Cloud (prev C1)」，兩條產品線的名稱也正在合流。

## Prompt 到 OpenUI Lang

![OpenUI Playground running the restaurant booking scenario in 2x speed](../public/media/openui-demo-2x.webp)

上方動畫對應一個模擬訂位情境，在 OpenUI 官方 Playground 上執行（模型選用 anthropic/claude-sonnet-4.6）。下文分析的 system prompt 與 raw output 則來自同一情境的本機 demo，模型使用 Gemini。原始業務 prompt 很短，主要提供幾項約束：`mobile-first restaurant reservation interface`、`quiet Chinese restaurant for 4 people tomorrow evening`、送出後顯示 `safe simulated confirmation state`。這些資訊只夠描述情境；若要讓模型輸出 renderer 能處理的 UI，還需要 OpenUI 在 system prompt 裡補上一份更嚴格的輸出合約。

我在本機 demo 裡看到的這份 prompt，大致可以拆成三層：

- **OpenUI 的基礎輸出規則**：先把模型的輸出通道限縮為 `openui-lang`。進入點必須叫 `root`，每一行都依照 `identifier = Expression` 撰寫，最後不能包在 Markdown、JSON、HTML 或程式碼圍欄裡。
  例子：`Your ENTIRE response must be valid openui-lang code`；`root is the entry point`。
- **元件庫展開後的完整 schema**：這是佔篇幅最大的一層。它把 runtime 能辨識的元件、參數順序、欄位型別、action 表達式、`$binding`、表單驗證等都交給模型。`CardHeader`、`TextContent`、`Carousel`、`Form`、`Button`、`FollowUpBlock` 這些元件能否正確呼叫，主要取決於這一層是否說清楚。
  例子（簽名有簡化）：`Button(label, action?, variant?)`；`Carousel([[title, image, description, tags], ...])`。
- **Demo 自行補上的任務約束**：最後才是訂位情境本身。這裡會要求優先使用 OpenUI 內建 chat 元件，送出後只做模擬確認，不能聲稱已完成真實訂位。實際使用時的 agent 設定一定會有所不同，例如某些按鈕可以透過 `Action([@ToAssistant(...)])` 把點擊轉換成下一輪對話，這個機制適合「換幾個選項」「繼續說明」「幫我比較一下」這類低風險動作；`Submit reservation request` 這類動作就不能只靠延續對話處理：UI runtime 讀取表單值，觸發明確的業務 action 或 mutation，後端處理庫存與權限，再把結果狀態送回前端。模型可以參與生成下一個畫面的文案和說明，訂位是否成功應以業務系統的回傳結果為準。
  例子：`quiet Chinese restaurant for 4 people tomorrow evening`；`do not claim a real booking was made`。

三層主要內容之後，生成的 prompt 還加入 few-shot examples。大致是用幾段小型 OpenUI Lang 程式示範「表格 + follow-up」「可點擊清單」「圖片輪播」「表單驗證」，告訴 LLM 該如何組織一個介面。最後再提供一段完整輸出大概會是什麼樣子：先寫 `root`，再逐一補上標題、清單、表單、按鈕和資料。

可以看到，最終的 Raw output 看起來像一張定義表。以下擷取開頭十多行：

```txt
root = Card([header, introCallout, sectionTitle1, restaurantCarousel, sectionTitle2, bookingForm, summaryCallout, followUps])

header = CardHeader("AI Table Finder", "Personalized recommendations & instant booking")

introCallout = Callout("info", "Match Found", "We found 3 quiet Chinese restaurants with private rooms available tomorrow evening for 4 people.")

sectionTitle1 = TextContent("Recommended Restaurants", "large-heavy")

restaurantCarousel = Carousel([[r1_title, r1_img, r1_desc, r1_tags, r1_btn], [r2_title, r2_img, r2_desc, r2_tags, r2_btn], [r3_title, r3_img, r3_desc, r3_tags, r3_btn]], "card")

r1_title = TextContent("The Jade Pavilion", "large-heavy")
r1_img = ImageBlock("https://picsum.photos/seed/jadepavilion/800/500", "Elegant Chinese dining room")
r1_desc = TextContent("A serene sanctuary specializing in Cantonese fine dining. Highly rated for its whisper-quiet atmosphere and exquisite dim sum.", "default")
r1_tags = TagBlock(["0.8 miles", "Rating: 4.9", "Noise: Quiet", "Private Room: Yes"])
r1_btn = Button("Select Jade Pavilion", Action([@ToAssistant("I want to select The Jade Pavilion")]))
```

它先列出頂層結構和幾個引用名稱，後面再依序補上 `header`、`restaurantCarousel` 等具體定義。這個順序對 OpenUI 很重要：parser 可以先接收 unresolved reference，等後續 chunk 抵達後再補上解析結果。換句話說，OpenUI Lang 的表達方式是為一邊生成、一邊渲染（Streaming rendering）而設計，它不必等整棵 JSON 樹完整閉合後才開始運作，這裡也還有其他解法。


## 參考資料

- [Thesys Introduces C1 to Launch the Era of Generative UI @ Thesys](https://www.businesswire.com/news/home/20250418761213/en/Thesys-Introduces-C1-to-Launch-the-Era-of-Generative-UI)：C1 在 2025-04-18 的公開新聞稿。
- [Conversational UI Concepts @ Thesys](https://docs.thesys.dev/guides/conversational/concepts#the-flow-of-a-conversation)：Thesys 官方文件裡的 conversation flow 示意圖。
- [Thesys @ Product Hunt](https://www.producthunt.com/products/thesys)：C1 在 2025-09-30 的 Product Hunt 發布紀錄，以及 OpenUI 在 2026-03-11 的 Product Hunt 發布紀錄。
- [Why We're Open Sourcing OpenUI @ Rabi](https://www.thesys.dev/blogs/openui)：Thesys 在 2026-03-11 發布的 OpenUI 開放原始碼說明。
- [API Changelog @ Thesys](https://docs.thesys.dev/api-reference/model-changelog)：`v-20260331` 起 C1 回應格式切換為 OpenUI 的變更紀錄。
- [OpenUI GitHub Repo @ thesysdev](https://github.com/thesysdev/openui)：OpenUI 的原始碼 repo；repo 建立時間早於公開發布，可作為原始碼歷史參考。
