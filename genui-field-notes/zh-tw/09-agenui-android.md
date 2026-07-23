# AGenUI：A2UI 的 Android 原生實作

第 4 章的天氣實驗透過 Flutter GenUI Renderer 接收並處理 A2UI 訊息。本章沿用同一套 Weather Server 和 A2UI 輸出，只把用戶端換成 AGenUI Android SDK，看看這份介面描述能否直接呈現為 Android 原生 View。

AGenUI 專案同時提供 Android、iOS 和 HarmonyOS Renderer，不過本章只討論並實際驗證其中的 Android 實作。iOS 與 HarmonyOS 僅作為專案結構的一部分簡單提及，不作實驗結論。

## 在 A2UI Basic Catalog 之上增加了什麼

AGenUI 1.2.0 的根 Catalog 共宣告了 25 個元件。其中 18 個來自 A2UI Basic Catalog；SDK 增加了 `Table`、`Carousel`、`Web` 和 `RichText`；`Chart`、`Markdown` 與 `Lottie` 則是 Playground 中註冊的自訂元件範例。因此，Lottie 這類元件並未綁定在基礎 SDK 裡，應用程式可以依照相同的註冊方式，選用自己的實作和相依套件。

樣式則是另一項明顯的擴充。AGenUI 為元件加入了一套接近 CSS 的 Styles，涵蓋尺寸、margin、padding、gap、Flex、定位、顏色、圓角和陰影等屬性，並提供 Design Token 與深色模式介面。下面節錄一段官方 Playground 的 `Card` 設定：

```json
{
  "id": "weather-card",
  "component": "Card",
  "child": "weather-body",
  "styles": {
    "padding": "24px",
    "border-radius": "16px",
    "background-color": "#FFFFFF"
  }
}
```

這些版面配置欄位會在共用的 Core 程式庫（C++）中交給 Yoga 計算。Yoga 是 Meta 維護的一套開源跨平台版面配置引擎，實作了接近 Web Flexbox 的版面配置規則；React Native 也使用它處理跨平台版面配置。AGenUI 將同一棵元件樹轉換成 Yoga Node，先計算每個節點的位置與尺寸，再把結果交給 Android、iOS 和 HarmonyOS 的平台 Renderer。

只使用 Basic Catalog 欄位時，同一份輸出便具備跨 Renderer 重用的基礎；使用這些 Styles 和擴充元件後，Agent 產生的內容便會逐漸依賴 AGenUI Catalog。實際上，輸出端因此取得更細緻的視覺控制；用戶端也需要認得相同的樣式和擴充元件，才能進一步客製化。

它對串流解析的處理也更細緻。外層 `updateComponents` 尚未完全閉合時，Core 已經可以抽取其中完整的元件物件；`Text`、`Markdown` 或 Data Model 中的長字串還能轉換成內部增量更新，讓文字提前出現。這裡的 `textChunk` 與 `appendDataModel` 屬於 AGenUI 用戶端內部訊息，伺服器端仍然傳送標準 A2UI 內容。

## 將 A2UI 訊息呈現為 Android View

AGenUI 主要是一套 A2UI v0.9 Renderer SDK。A2UI 負責 `Surface`、Component、Data Model 和 Action 的訊息合約，AGenUI 則接住這些訊息，在用戶端建立和更新介面。至於訊息是透過 SSE、WebSocket、A2A，還是應用程式既有的長連線，仍由宿主 App 決定。

Android SDK 留給宿主的串流入口很簡單，網路層每收到一個 chunk，便把它送進 `SurfaceManager`：

```java
surfaceManager.beginTextStream();
for (String chunk : responseChunks) {
    surfaceManager.receiveTextChunk(chunk);
}
surfaceManager.endTextStream();
```

共用的 C++ Core 緊接著完成協定解析、Data Model 綁定、元件樹維護、Yoga 版面配置和欄位 diff；JNI 將結果交給 Android Renderer，最後建立 `TextView`、`CardView` 等原生 View。Surface 建立完成後，宿主只要把它的根容器加入目前頁面：

```java
public void onCreateSurface(Surface surface) {
    container.addView(surface.getContainer());
}
```

Android 仍然會執行自己的 measure / layout。AGenUI 提供的 `YogaAbsoluteLayout` 根據 Core 的計算結果擺放原生 View，最終承載互動與繪製的仍是 Android 控制項。這套 Core 也由 iOS 和 HarmonyOS Renderer 共用，兩者分別串接 UIKit 與 ArkUI；自訂視覺元件依然需要各平台提供自己的實作。

## 換掉 Flutter 用戶端

本次實驗直接沿用第 4 章的 Python A2A / A2UI Weather Server。Mock 天氣資料、A2UI v0.9 訊息和伺服器端 Action 處理均維持原樣；Android App 則補上 Agent Card 請求、A2A SSE 解析、Surface 容器和 Action 轉送。驗證環境為 AGenUI 1.2.0、Android 15，以及 Pixel 7 API 35 模擬器。

首次請求傳回 `createSurface`、`updateDataModel` 和 `updateComponents`，Android 端據此建立天氣卡片。整個過程沒有 AGenUI 專用的訊息轉換：從 A2A `DataPart` 取出的 JSON 會直接交給 `SurfaceManager`。

![AGenUI Android 呈現 Singapore 天氣卡片](../public/media/agenui-android-singapore.png)

*同一份 A2UI Weather 輸出由 AGenUI 呈現為 Android 原生 View。截圖使用 SDK 預設主題，未額外註冊 Theme。*

點選卡片裡的 London 按鈕後，AGenUI 產生一筆大小為 174 bytes 的 Action Event，宿主 App 將其送回同一個 A2A Server。伺服器傳回一筆大小為 656 bytes 的 `updateDataModel`，沒有再次傳送 `updateComponents`；AGenUI Core 重新解析資料綁定和欄位變更，既有 Android View 隨之顯示 London 天氣。

![AGenUI Android 原地更新 London 天氣資料](../public/media/agenui-android-london-data-update.png)

*London Action 傳回後只更新 Data Model，仍沿用既有的 Surface 和 Android View。*

同一套伺服器先後驅動 Flutter Widget 與 Android View，這個結果比多貼幾段 Log 更直接：Basic Catalog 範圍內的 A2UI 輸出確實具備跨 Renderer 重用的基礎。

## 能呈現後，還得看看整體效果

第一次跑出 Android 頁面時，有個問題非常明顯：卡片裡的內容幾乎緊貼邊緣。檢查原始碼後便能找到原因，AGenUI 預設 `Card` 樣式只宣告了寬度、高度和 `16px` 圓角，沒有 content padding。Android `CardComponent` 支援把 Styles 中的 padding 對應到 `CardView.setContentPadding()`，但預設值卻是 0，匪夷所思。

所以，預設樣式適合驗證協定與 Renderer，正式產品還要重新註冊自己的 Theme 和 Design Token，把卡片留白、元件間距、字級、顏色、深色模式與無障礙規則補齊。視覺參數全部交給模型臨時決定也不划算，應用程式的基礎 Theme 更適合維持穩定的品牌與平台規範，A2UI Styles 再處理確實需要動態變化的部分。

宿主 App 還有一些工作要做。A2A Task、對話延續性和斷線恢復屬於外圍 Transport；Catalog 需要配合用戶端版本管理；`Web`、`RichText` 這類功能較多的元件還要補上網域、URL Scheme、HTML 和導向策略。導入 AGenUI 也表示 Android 專案會增加 C++、NDK 和 CMake 工具鏈，這些內容都應該計入維護成本。

## 一點判斷

本次實驗確認了同一套 A2UI Weather Server 可以同時服務 Flutter 與 AGenUI Android 用戶端。AGenUI 最值得觀察的部分集中在 Renderer 工程實作：共用的 C++ Core、Android 原生元件、更細緻的串流解析、Data Model 綁定和欄位 diff。它讓 A2UI 進入原生 App 有了一條能直接跑起來的路線。

不過，產品仍要維護 Theme、Android 宿主、Transport 和自己的元件擴充。使用 AGenUI Styles 越多，介面表現越豐富，與這套 Renderer 的綁定也越深。對於已經擁有 Android 原生元件系統，又希望導入 A2UI Agent 的團隊，這項取捨相對容易理解。

## 參考資料

- [AGenUI README](https://github.com/AGenUI/AGenUI/blob/7112bfb8180fb4fd7e27ad6e8808c3da550a117d/README.md)
- [AGenUI Changelog](https://github.com/AGenUI/AGenUI/blob/7112bfb8180fb4fd7e27ad6e8808c3da550a117d/CHANGELOG.md)
- [AGenUI Catalog](https://github.com/AGenUI/AGenUI/blob/7112bfb8180fb4fd7e27ad6e8808c3da550a117d/agenui_catalog.json)
- [AGenUI API](https://github.com/AGenUI/AGenUI/blob/7112bfb8180fb4fd7e27ad6e8808c3da550a117d/docs/API.md)
- [A2UI Basic Catalog](https://a2ui.org/specification/v0_9/basic_catalog.json)
- [Yoga](https://www.yogalayout.dev/)
