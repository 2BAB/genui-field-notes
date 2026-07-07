# UI 生成时，不同框架的输出细节比对

前面几篇分别看了 OpenUI / Thesys C1 和 Google A2UI。读到这里，可以先把问题收窄到一个更具体的层面：当用户发出一次请求，模型或 agent 在“生成 UI”这一步，到底吐出了什么东西？

这个问题很容易被产品截图掩盖。最后看起来都可能是一张卡片、一个表单、一组按钮，但生成时的中间产物差异很大。它决定了后续能不能流式渲染、能不能局部更新、能不能跨端、能不能把用户动作继续送回 agent。

## A2UI 更像 agent-driven BDUI

如果用移动端开发者熟悉的说法，A2UI 很像一种 **agent-driven BDUI**。

传统 BDUI 里，客户端提前实现一套组件和 renderer，服务端按业务规则下发页面结构、组件参数、数据和 action。A2UI 继承了这个基本形态：客户端仍然有受控组件 catalog，renderer 仍然在本地，用户动作也通过协议回传。变化在于，组装 payload 的角色从固定业务后端、配置平台或运营系统，变成了 agent / LLM。

所以 A2UI 生成时输出的重点会落在一组协议消息上，临时拼出来的 UI 代码不在这条路径里。例如：

```json
{"version":"v0.9","createSurface":{"surfaceId":"weather","catalogId":"https://a2ui.org/specification/v0_9/basic_catalog.json"}}
{"version":"v0.9","updateDataModel":{"surfaceId":"weather","path":"/","value":{"city":"Singapore","temperature_c":26}}}
{"version":"v0.9","updateComponents":{"surfaceId":"weather","components":[{"id":"root","component":"Column","children":["heroCard","cityCard"]}]}}
```

这里的 `catalogId` 可以理解成这块 surface 使用的组件目录。客户端先声明自己支持哪套 catalog，服务端或 agent 在 `createSurface` 里选中同一个 ID；后面的 `Column`、`Card`、`Button` 这类组件名和参数，才会按这套目录来解释。它不是让 App 去这个 URL 动态下载代码，更像是双方约定“这次 UI 只能从这本组件词典里选词”。

这套输出里有几个比较 BDUI 的味道：`surfaceId` 表示一块可更新区域，`components` 表示组件结构，`dataModel` 表示状态，`action` 表示用户行为入口。客户端只需要识别这些受控对象，再把它们映射到 Web / Flutter / SwiftUI / Jetpack Compose 等本地组件。

A2UI 的 message 本身是 JSON object，直接流式传输时通常会用 JSONL 表达，一行一个 message；如果走 A2A、MCP 或普通 HTTP，也可以把这些 messages 包在普通 JSON payload 里传输。不过普通 HTTP JSON array 只能算最简单的承载方式，适合小 payload 或已经生成好的 UI。A2UI 真正有价值的场景通常需要 streaming transport，否则既容易等 LLM / tool call 超时，也失去了逐步构建 UI 的意义。因此 A2UI 说自己 transport-agnostic，不等于所有 transport 都同样适合。对生成式 UI 来说，SSE、WebSocket、A2A streaming 这类能持续送 message 的通道，才更接近它的设计预期。

这也是 A2UI 跨端路线相对清楚的原因。模型输出被压到组件 catalog 里的结构化选择和组合，客户端继续持有可执行代码和组件实现。移动端过去做动态首页、活动位、瀑布流 Cell 时，已经有不少类似经验；A2UI 把 agent 放进了这条链路。

## OpenUI 更像 prompt-driven UI DSL

OpenUI 也会把组件库和 schema 暴露给模型，让模型在受控组件里选择和组合。但它生成时的产物更像一段 **prompt-driven UI DSL**，和传统 BDUI payload 的距离更远。

OpenUI Lang 的输出大概是这种形状：

```txt
root = Stack([header, list, form])
header = CardHeader("Reserve", "Find a quiet restaurant")
form = Form([dateField, timeField, submitButton])
submitButton = Button("Submit", Action([@ToAssistant("Submit reservation")]))
```

这里的重点是语言形态。OpenUI 用 named statements 表达 UI，`root` 是入口，后面的语句逐步补齐引用。这个格式对 LLM 友好，也适合流式解析：parser 可以先看到 `root` 和若干未解析引用，再随着后续 chunk 到达补完整棵 UI。

因此，OpenUI 粗略看也是“把组件库定义给 AI，让 AI 组装 UI”。但它和传统 BDUI 的亲缘关系弱一些。A2UI 的输出像协议消息，强调 surface、component、data model、action 的分离；OpenUI 的输出像一门紧凑的 UI 表达语言，强调模型能用较少 token、按顺序说出一段可被 renderer 消费的 UI。

这个区别会影响后面的运行时问题。A2UI 后续更自然地讨论 data model update、action event、transport 和跨端 renderer；OpenUI 后续更自然地讨论 parser、query / mutation、binding，以及这套 DSL 怎样在 Web renderer 里继续工作。
