# UI 生成时，不同框架的输出细节比对

前面几章的重点是各家框架/协议在做什么，以及一套 GenUI 产品大致是怎样工作，给了一些 Demo。从本章开始，我们往实现细节里再走一层。先看 UI 生成阶段：同样输入一份 Singapore weather snapshot，OpenUI 和 A2UI 在 renderer 前面分别生成了什么？Vercel 由于内容不多，就不参与本章的分析。

OpenUI 天气 demo 使用 10 个天气领域组件，由 Gemini 3.5 Flash 生成 OpenUI Lang，再交给 React renderer：

![OpenUI Singapore weather demo](../public/media/openui-weather-singapore.png)

A2UI 天气 demo 使用 v0.9 Basic Catalog，同样由 Gemini 3.5 Flash 生成 A2UI messages。服务端完成校验后，再交给 Flutter renderer：

![A2UI Flutter Singapore weather demo](../public/media/a2ui-weather-singapore.png)

两边使用同一份固定数据：Singapore、26°C、体感 29°C、湿度 82%、风速 13 km/h，也都保留了真实 Gemini request、raw SSE 和最终输出。这样可以直接看两套生成合约的差异，同时观察同一个模型面对两种表达方式时的实际结果；但我们刻意让 OpenUI 在这一轮使用更 semantic 的大组件，A2UI 使用更原子一些的，以此来对比这方面的行为细节。注意，本章对比手法并不完全严谨（控制变量）。

## 生成端先拿到什么

模型要生成 UI，第一步是先知道自己可以使用哪些组件，以及应该按什么格式输出。

OpenUI 会把 component library 展开成 system prompt。天气实验注册了 `WeatherCanvas`、`WeatherHero`、`MetricGrid`、`HourlyForecast`、`DailyForecast`、`UnitToggle`、`ActionButton` 等 10 个组件，最后生成的 system prompt 约 8,900 个字符，使用 GPT-5 tokenizer 计算为 2,205 tokens。它主要包含四部分：

1. OpenUI Lang 的语法，例如每行使用 `identifier = Expression`，`root` 是入口。
2. 组件的 signature、参数顺序和字段类型。
3. `$unit`、`@Set`、`@ToAssistant`、`Query()` 等状态、行为和数据规则。
4. 一份完整的天气 UI few-shot example。

本轮 user message 只有一句 `Show Singapore weather` 和固定 weather snapshot。模型根据 system prompt 选择组件，React 组件的内部布局和样式仍由应用代码决定。

A2UI 先由客户端声明自己支持的 catalog：

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

`catalogId` 是客户端和 agent 共同使用的组件词典。客户端借它说明“我能渲染哪些组件”；agent 或 generation middleware 再把 protocol schema、catalog 和生成规则整理给模型。A2UI 规定通信合约，system prompt 由每个 agent 实现自行组织。

本次 A2UI system prompt 是一份针对天气 demo 裁剪过的生成合约，共 9,466 个字符、2,323 tokens，主要包含四部分：

1. `createSurface`、`updateDataModel`、`updateComponents` 三条消息的顺序和固定字段。
2. `Card`、`Column`、`Row`、`Text`、`Icon`、`Divider`、`Button` 七种 Basic Catalog 元组件的属性约束。
3. 组件 ID、引用、数据、四个城市 action，以及窄屏每行两个按钮的规则。
4. 一份完整的 Tokyo 66-component few-shot example。

而一轮 user message 为一句当前请求加完整 weather snapshot，像 demo 里的这轮共 542 个字符、150 tokens。模型生成 JSONL 后，服务端继续检查 catalog、消息顺序、数据、组件树和 action，再把通过校验的三条消息交给 A2A。

这两个起点已经带出一项工程差异：OpenUI 的生成合约通常跟着 Web 服务和 component library 一起发布；A2UI 的 catalog 同时受客户端版本约束，服务端需要先知道当前 Android、iOS 或 Flutter 客户端能画什么。

## 第一次生成：OpenUI Lang 和 A2UI Messages

OpenUI 返回的是一段以 `root` 为入口的 UI 程序。本次真实 Gemini 输出一共 17 条 statements，开头如下：

```text
root = WeatherCanvas([hero, metrics, hourly, daily, advisory, controls])
$unit = "c"
hero = WeatherHero("Singapore", "Singapore", "2026-06-22 20:00 SGT", 26, 29, "Mostly cloudy", "Mostly cloudy and humid...", $unit)
metrics = MetricGrid([humidity, wind, rain, heat])
```

第一行先列出整棵 UI 的主要部分，后面的 statement 再依次补上 `hero`、`metrics`、`controls`。组件使用位置参数，字段名已经写在 component signature 里，模型无需在每次调用时重复输出。

A2UI 返回的是几条有顺序的消息。为了便于阅读，下面只保留每条消息的主要字段：

```jsonl
{"version":"v0.9","createSurface":{"surfaceId":"weather","catalogId":".../basic_catalog.json"}}
{"version":"v0.9","updateDataModel":{"surfaceId":"weather","path":"/","value":{"city":"Singapore","temperature_c":26}}}
{"version":"v0.9","updateComponents":{"surfaceId":"weather","components":[{"id":"root","component":"Column","children":["heroCard","cityCard"]}]}}
```

`createSurface` 建立一块可以继续更新的 UI；`updateDataModel` 写入数据；`updateComponents` 写入带 ID 的组件树。结构、数据和 Surface 生命周期在协议里各有自己的位置。

把真实产物压成无多余空格的形式，再用 OpenUI 官方 benchmark 相同的 `tiktoken.encoding_for_model("gpt-5")` 计算，可以得到下面的数字：

|本地记录|字符数|GPT-5 tokenizer|输出规模|
|:---|---:|---:|:---|
|OpenUI：真实 Gemini Singapore 输出|1,467|432 tokens|17 statements|
|A2UI：真实 Gemini Singapore 输出|6,747|1,633 tokens|3 messages，66 components|

两行都是 Gemini 3.5 Flash 的真实输出，OpenUI 这一轮少了约 73.5%。A2UI 的 1,633 tokens 里，`updateComponents` 一条消息占 1,482 tokens，主要篇幅都花在 66 个元组件的 ID、类型、属性和引用关系上。

同一组 A2UI 记录里还有一项更直接影响体验的数据：Singapore 一轮 Gemini generation latency 为 14,057 ms，London action 为 11,977 ms。当前实现会等完整 JSONL 返回并通过校验，再把 A2UI messages 交给客户端，因此首次 Surface 至少要先等这段模型生成结束，之后还有校验和渲染。这两个数字只对应本次实现，A2UI 的理论下限仍需另测；它们也说明 token efficiency 需要和用户实际等待放在一起观察。

OpenUI 官方也把 token efficiency 当作 OpenUI Lang 的主要设计目标。其官方 benchmark 使用 GPT-5.2 在 7 个场景里先生成 OpenUI Lang，再把同一棵 AST 转成 Vercel JSON-Render 和 Thesys C1 JSON。总计结果是 OpenUI Lang 4,800 tokens、Vercel 10,180 tokens、C1 9,948 tokens，分别减少 52.8% 和 51.7%；单个 contact form 场景最高减少 67.1%。这份官方测试覆盖 Vercel 和 C1，本章的 A2UI 数字来自另外一组天气实验。

OpenUI 在第一次生成里更省输出 token。这个结果同时来自两个地方：一是位置参数和引用让 OpenUI Lang 比 JSON 紧凑；二是本次 OpenUI 使用天气领域组件，A2UI 使用 Basic Catalog 元组件。本轮保留了两套框架各自更自然的用法，因此测到的是整套输出合约的成本；若要单独测语言格式，还需要再做一组相同组件粒度的实验。这边以官方的测试结果（减少~50%）作为主要参考，我们的 demo 场景没有严格限定死 UI 设计（即没有控制变量）。

## 组件粒度：模型在选卡片，还是在排 Layout

OpenUI 的 `WeatherHero(...)` 已经包含城市、温度、天气图标、体感和摘要。模型调用一次，React renderer 再把它展开成完整的 hero 区域。

A2UI Basic Catalog 里只有 `Card`、`Column`、`Row`、`Text`、`Icon`、`Divider`、`Button` 等元组件。同一个 hero 需要逐层写出 `heroCard`、`heroBody`、`locationRow`、`temperatureRow` 和各个 Text 节点。本次一共用了 66 个 components，其中 `updateComponents` 一条消息就占 1,482 tokens。

因此，432 和 1,633 同时体现了 DSL 格式与组件粒度。假如 A2UI catalog 预先提供一个 `WeatherCard`，组件数和 payload 都会明显缩小；假如 OpenUI 只开放 `Stack`、`Text`、`Icon` 这些元组件，它也要输出更多 statements。

组件粒度实际决定了模型参与多少设计。Semantic Component 路线让模型选择“用哪张天气卡”；元组件路线让模型继续决定卡片内部有哪些 Row、Column 和 Text。前者更容易稳定落地，后者保留更多布局自由，也会增加 token、生成校验和视觉测试的成本。

这次 A2UI 实验第一次就遇到了一个很具体的例子。Gemini 输出了 70 个 components，协议字段、组件引用和 action 都能通过校验，但它把三个城市按钮排进同一个 Row，Flutter 最终报出右侧 65 pixels 的 `RenderFlex overflow`。随后在 prompt 和 validator 里同时加入“窄屏每行两个城市按钮”的规则，第二次输出收敛为 66 个 components，Singapore 和 London 都完成了原生渲染。

因此，组件树通过 schema 只是第一道检查。元组件越自由，生成端越需要理解 renderer 的实际尺寸约束；截图、overflow log 和多尺寸测试也会逐渐变成生成链路的一部分。

## 后续更新：只改数据，还是重生成 UI

第一次生成的长度只覆盖了一半问题，在UI 显示后，用户点击 London，服务端拿到新的天气数据，框架是否还要把整棵 UI 再描述一遍？

本章记录的第一轮 A2UI demo 直接把 `"text": "Singapore"` 这类 literal value 写进组件。点击 London 后，`select_city { city: London }` 会开始下一轮 Gemini 生成，再发送 `createSurface + updateDataModel + updateComponents(66)`；这次真实输出是 1,636 tokens。这一轮先验证完整的 action round trip，后续完成的 data-bound 版本及 payload、rebuild、state preservation 结果放在下一章。

如果组件已经绑定 Data Model path，完整 London snapshot 的 `updateDataModel` 是 410 个字符、109 tokens；只更新 `/temperature_c` 的消息是 95 个字符、27 tokens。相比重新生成 1,636 tokens，这个差距已经足够说明组件树复用后可能节省的输出成本。

OpenUI 当前 demo 的城市按钮使用 `@ToAssistant("Show Tokyo weather")`，下一轮重新输出完整 UI 程序，共 450 tokens。`Query()` 可以让 runtime 重新请求数据而不生成布局。这里先记录两条路径的输出成本，具体的 binding 机制、Query 生命周期和职责归属放到下一章。

## 流式生成：一行行补齐，还是一条条更新

OpenUI 的渐进单位接近文本。实验把 Singapore fixture 每 37 个字符切成一个 chunk，共 43 个 chunks。第一段到达后，parser 已经能根据 `root = WeatherCanvas(...)` 建立外壳；暂时缺失的 `hero`、`metrics` 等引用会随着后续 statement 到达而补齐。最终得到 17 statements、0 unresolved、0 parser errors。

这条路径的代价也出现在 renderer。浏览器最终画面正常，但 progressive reconciliation 期间记录了 36 条 duplicate-key warnings。parser 证明了语法和引用能够收敛，React renderer 还要处理同一棵树被反复 materialize 时的节点身份。

A2UI 以完整 message 为增量单位。renderer 先处理 `createSurface`，再处理 `updateDataModel` 和 `updateComponents`；组件通过 ID 定位，后续消息继续替换数据或组件。它通常要等一条 JSON message 闭合后再应用，换来的是更明确的更新边界。

两者的 streaming 发生在不同粒度。OpenUI 更关注一轮回答里尽早露出 UI；A2UI 的 message 和 ID 更适合一块会存活较久、还会被后续消息更新的 Surface。

## 数据由模型编，还是由业务系统填

OpenUI + Gemini 的实验还暴露了一个实际的问题，比如当 user message 提供的数据只有当前天气：

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

而 system prompt 的 few-shot example 里同时放了一份 hourly 和 3-day 预测，这导致模型最后输出了下面两条合法的 OpenUI Lang：

```text
hourly = HourlyForecast(["20:00", "21:00", "22:00", ...], [26, 26, 26, 25, ...], ["Cloudy", "Shower", ...], $unit)
daily = DailyForecast(["Today", "Tue", "Wed"], [31, 31, 30], [25, 25, 25], ["Thunderstorms", "Showers", "Cloudy"], [70, 65, 45], $unit)
```

本轮 snapshot 的字段到 `rainChance` 为止，未来预报来自 few-shot 的示范内容。OpenUI 的 parser 表示 0 errors，因为字段类型、组件名称和引用关系全部正确；也即它能检查“这是不是一个合法的 `DailyForecast`”，无法判断“周二 31°C 是否来自天气 API”（数据准确性）。

A2UI 实验里，Python 服务端先选择固定 `WeatherSnapshot`，再把完整 snapshot 放进 user message。Gemini 负责生成 Data Model 和 component tree；validator 要求 `updateDataModel.value` 与服务端 snapshot 逐字段一致，因此 Singapore、London 的 Data Model 都能追到 mock data source。本章捕获的两轮 Gemini output 仍使用 literal text props，内容与 snapshot 一致；下一章的 data-bound 版本把 13 个天气文本改为 `/weather/...` bindings。

产品里的业务数据通常应该保留一条可追踪/观测的来源：模型选择组件和布局，天气、订单、库存等值由 tool/API 返回。例如：OpenUI 可以用 `Query()` 把 tool result 接入组件；A2UI 可以让 backend 写入 `updateDataModel`，组件只绑定对应 path。这样 parser/schema 负责 UI 合法性，业务系统继续负责数据真实性。

## 从产品落地反推选择

OpenUI 的早期 PMF 更接近 Web 和 chat-like GenUI。团队可以跟随服务端快速更新 component library，用紧凑的语言生成一次性卡片、表单和报表，也可以把 `Query()`、`Mutation()` 留在 Web runtime 里执行。它要求团队能控制前端 runtime（本章实验为 React），并持续观察 prompt、parser、renderer 和模型输出质量。

A2UI 更适合已经拥有 native component system 的产品。客户端实现 catalog，Surface 和 Data Model 可以跨多轮继续存在；服务端通过组件 ID 和 data path 更新局部内容。它需要处理 Android、iOS、Flutter/Web 多端组件、catalog version、旧客户端和 transport，这些投入只有在原生体验或长生命周期 Surface 确实重要时才划算。

而开头提到的固定语义组件 vs 原子组件拼凑，很显然还是固定语义组件加成本最低。当前这些 GenUI 协议产生价值的地方，是 UI 结构会随任务改变，或者同一块 Surface 需要持续接收 agent 更新。快速生成一整段新 Web UI 更接近 OpenUI 当前的产品路径；长期维护一块可持续更新的多端原生 UI，或许更能发挥 A2UI 的协议设计。


## 参考资料

- [OpenUI Lang Overview @ OpenUI](https://www.openui.com/docs/openui-lang/overview)
- [OpenUI Token Efficiency Benchmarks @ GitHub](https://github.com/thesysdev/openui/tree/main/benchmarks)
- [OpenUI Lang Renderer @ OpenUI](https://www.openui.com/docs/openui-lang/renderer)
- [A2UI Messages @ A2UI](https://a2ui.org/reference/messages/)
- [A2UI Components & Structure @ A2UI](https://a2ui.org/concepts/components/)
- [A2UI Data Flow @ A2UI](https://a2ui.org/concepts/data-flow/)
