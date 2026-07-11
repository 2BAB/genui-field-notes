# Agent 开发里的 GenUI：UI 如何进入一次 Run

承接前两章再往深处走一步，问题会落到 Agent runtime：这段 UI 怎样成为一次 Agent 执行的一部分？用户点击按钮以后，系统又怎样带着前面的上下文继续？

这里沿着一次完整的 Run 来看。OpenUI 和 A2UI 仍然是主要比较对象，Vercel AI SDK 作为一条轻量的实现参照。

## 从 Thread 到 Run

在 chat-like 产品里，Thread 是一段持续存在的会话，Run（名词）是其中一次有起点、有过程、有终点的 Agent 执行。用户发送消息可以开始一次 Run；生成 UI 里的按钮、表单提交或 approval，也可以开始下一次 Run。

AG-UI 把这个边界定义得很直接。`RunAgentInput` 里包含 `threadId`、`runId`、`state`、`messages`、`tools`、`context` 和 `forwardedProps`；事件流以 `RUN_STARTED` 开始，以 `RUN_FINISHED` 或 `RUN_ERROR` 结束。中间可以穿插 text、tool call、state 和 activity events。

把它压缩成一条线，大致是：

```text
Thread
  -> Run #1: user message -> model / tools -> generated UI -> finish
  -> user interacts with the UI
  -> Run #2: action + thread context -> model / tools -> UI update -> finish
```

Run 和 transport 是两件事。AG-UI 可以走 SSE、WebSocket 或其他传输；A2UI messages 可以放进 A2A `DataPart`，也可以由 AG-UI middleware 放进 event stream。我们的 Flutter 天气实验走的是 A2A + A2UI，本章后面提到的 `ACTIVITY_SNAPSHOT` 和 recovery loop 则来自 AG-UI / CopilotKit 的上游实现。

## 一次 Run 从什么开始

模型在 Run 开始时需要两类信息：任务上下文，以及当前客户端可以承接的 UI 能力。几种方案对这两类输入的组织方式不同。

OpenUI 的 `ChatProvider` 管理 thread、messages 和 streaming state。调用 `processMessage()` 后，它把 `threadId` 和当前 messages 发给后端，再由 stream adapter 把 AG-UI、OpenAI Responses 或自定义后端的输出转成统一消息。真正调用模型时，服务端还要加入 component library 生成的 OpenUI Lang 合约，以及本轮可以使用的 tools。

A2UI 把重点放在 UI payload，Agent Run 的输入由 A2A、AG-UI 或具体 runtime 组织。走 A2A 时，Flutter 客户端会把 `supportedCatalogIds` 放进 request metadata，服务端据此返回客户端能渲染的 A2UI messages；走 AG-UI / CopilotKit 时，catalog capabilities、component schema 和 generation guidelines 会进入 `RunAgentInput.context`，middleware 还可以注入 `render_a2ui` tool。Agent 因而同时拿到会话上下文和客户端的 UI 边界。

Vercel AI SDK 的路径更短。浏览器先产生 `UIMessage`，`createAgentUIStream` 验证历史消息，再把它转换成模型使用的 `ModelMessage`。tool definition 跟着 model request 一起进入 Run，模型选择 tool，应用再把对应的 typed tool part 映射到 React 组件。

实际上，这一步是决定了模型要做什么：OpenUI 给模型的是语言规则和 component signatures；A2UI 给模型的是 catalog/schema；Vercel 的常见做法则给模型一组 tools。UI 的自由度在 Run 开始前就已经由这些输入划定。

## UI 在 Run 中怎样返回

OpenUI 把生成结果放在 assistant message 的 content 里。模型逐段输出 OpenUI Lang，前端 adapter 累加文本，streaming parser 在 statement 闭合后更新 AST，React renderer 再把组件调用映射成应用注册的组件。`ChatProvider` 会用同一个 message ID 持续更新当前 assistant message，所以一段未完成的 UI 可以在 Run 结束前逐步出现。

A2UI messages 是另一层 payload。走 A2A 时，一组 `createSurface`、`updateDataModel`、`updateComponents` 会装进 `application/a2ui+json` 的 `DataPart`，客户端按顺序交给 `SurfaceController`。走 AG-UI middleware 时，A2UI Surface 会成为一条 `ACTIVITY_SNAPSHOT`：同一个稳定的 `messageId` 先承载 `building` 或 `retrying`，通过验证后再替换成最终的 `a2ui_operations`。这样，Agent Run 的 loading、修复和最终 Surface 都落在同一个 activity 位置上。

Vercel AI SDK 则把 text、reasoning、tool input、tool output 和 custom data 转成 `UIMessageChunk`。`useChat` 增量合并这些 chunks，React 根据 `tool-weather` 之类的 typed part 选择预先写好的组件。它解决的是 Agent stream 到前端状态的衔接，卡片内部的 UI 结构仍然来自应用代码。

三条路径的共同点很清楚：生成 UI 需要成为 Run 的一种可识别输出，前端还需要稳定的 message 或 activity identity，才能把 streaming 过程合并到正确的位置。

## 用户动作如何进入下一次 Run

UI 里的本地切换可以留在 runtime，业务 API 也可以直接执行。这里关心第三类动作：用户希望 Agent 继续理解意图、调用工具或重新组织 UI。

OpenUI 的 `@ToAssistant(...)` 会触发 `ContinueConversation`。事件里包含 `humanFriendlyMessage`，还可以带上 `formState` 和 `formName`。Host 收到后调用 `processMessage()`，把它作为新的消息发回同一个 Thread，下一次 Run 由此开始。天气实验里的 “Show Tokyo weather” 就走了这条线。

A2UI action 会带上 `surfaceId`、`sourceComponentId`、action name 和 context。A2UI 只定义这份 client event，Host 决定后续执行方式。我们的 Flutter 实验把 `select_city` 作为 A2A data part 发回 Python server；CopilotKit 的 React bridge 则把它放进 `forwardedProps.a2uiAction`，随后调用 `runAgent()`。AG-UI 的 A2UI middleware 会把 action 整理成 synthetic assistant/tool messages，让 Agent 在历史记录里看到这次 UI 交互。

```text
Run #1 output
  -> OpenUI message / A2UI Surface
  -> user action
  -> action payload + Thread context
  -> Run #2 input
```

这里的关联信息需要保留 UI identity。OpenUI 需要知道动作来自哪条 assistant message 和哪份 form state；A2UI 通过 Surface 和 component ID 定位来源；Agent runtime 则用 `threadId`、`runId`、tool call ID 或 action ID 串起前后两轮。缺少这些 ID 时，日志里只能看到“按钮被点了”和“又跑了一次模型”，就很难解释两者之间发生了什么。

## 确认、审批与 Run 的暂停

高风险动作通常会把一次执行拆成两次 Run。第一轮 Agent 提议发送邮件或提交订单，前端显示 confirmation / approval UI；用户确认后，第二轮才真正执行 tool。

AG-UI 的 interrupt lifecycle 给了一个比较完整的表达：Run #1 以 `RUN_FINISHED` 结束，`outcome.type` 为 `interrupt`，其中包含 `interruptId`、提示文字、可选的 `toolCallId` 和 `responseSchema`。用户做出选择后，客户端在同一个 Thread 里开始 Run #2，并把结果放进 `RunAgentInput.resume[]`。若需要恢复状态，Agent 应在第一次 Run 结束前发送 `STATE_SNAPSHOT` 和 `MESSAGES_SNAPSHOT`。

A2UI 可以负责渲染这张确认卡和收集结构化输入，interrupt / resume 的执行语义来自外围 Agent protocol。OpenUI 也可以生成 confirmation form，再由 Host 把结果交给自己的 Agent runtime。Vercel AI SDK 提供 tool execution approval；当前天气实验只覆盖普通 tool flow，这条路径留在后续验证。

这样拆开后，界面负责呈现与收集，Agent runtime 负责暂停、关联、恢复和审计。一次点击是否已经执行真实业务，也能从 Run 的状态里判断出来。

## 失败发生在哪一层

GenUI 进入 Agent Run 后，错误大致分为三层。

第一层是生成合约。OpenUI parser 可以报告语法、组件和参数错误；A2UI generation 需要检查 message schema、catalog、component reference 和 data。AG-UI 上游的 A2UI toolkit 实现了一条 validate -> retry 路径：默认最多尝试三次，把上一轮的结构化错误追加到 prompt，通过验证的 operations 才进入 renderer。这个行为来自上游 toolkit 源码和测试；当前 Flutter 天气实验使用自己的 validator，接入该 recovery loop 是下一步验证。

第二层是 Run 和 transport。`RUN_ERROR`、超时、取消、SSE 断开、重复 action 都需要关联到明确的 `runId`。涉及 approval 时，还要检查 resume 是否属于同一个 Thread、`interruptId` 是否有效，以及重复提交是否具备幂等性。

第三层是最终渲染和业务执行。A2UI 天气实验第一次生成的 70 个 components 可以通过协议校验，Flutter 仍然出现了 65 pixels 的 overflow；OpenUI 的 Query 或 Mutation 也可能在运行时遇到网络、权限或业务错误。schema 能检查结构，截图、layout log、tool result 和业务状态继续检查真实结果。

## 一次 Run 应该留下什么

如果要让整条链路可观测、排查问题，一次 GenUI Run 至少需要留下这些记录：

1. `threadId`、`runId`、触发来源，以及前一轮 Run 或 action 的关联 ID。
2. 发给 Agent 的 messages、state、tools、catalog/schema 和 client capabilities。
3. model output、tool call / result、原始 UI payload，以及 parser / validator 的结果。
4. 发给客户端的 stream events、message/activity ID 和最终 Surface 版本。
5. renderer error、截图、用户 action payload，以及下一次 Run 的入口。

Vercel 天气实验把 Browser、API、model、tool、UI stream 和 raw SSE 分开记录；A2UI 天气实验保留了 A2A request、A2UI messages、Flutter log 和两轮截图。这种记录方式比只保存最终画面更有用，就像前面两章提到的：UI 既是本轮 Run 的输出、Thread 中的一段可恢复记录，也是下一轮 Run 的输入入口。

## 参考资料

- [Core architecture @ AG-UI](https://docs.ag-ui.com/concepts/architecture)
- [Events @ AG-UI](https://docs.ag-ui.com/concepts/events)
- [Interrupts @ AG-UI](https://docs.ag-ui.com/concepts/interrupts)
- [A2UI Transports @ A2UI](https://a2ui.org/concepts/transports/)
- [OpenUI React Headless @ GitHub](https://github.com/thesysdev/openui/tree/main/packages/react-headless)
- [Generative User Interfaces @ Vercel AI SDK](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces)
