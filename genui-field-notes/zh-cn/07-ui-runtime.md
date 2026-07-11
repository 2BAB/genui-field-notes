# UI 生成后，不同框架的数据和行为如何继续流转

UI 被 renderer 绘制出来，只能证明生成和渲染已经接通；用户接下来会切换 Tab、选择城市、填写表单、提交订单，服务端的数据也可能会独立变化需要通知到客户端。一个 GenUI framework 能否进入真实产品，更多时候取决于这些动作如何继续。承接上一章，本章继续对比 OpenUI 和 A2UI 在这些场景下的操作，并继承上一章的天气 demo。

我们先看几次真实点击，再把问题拆成三类：本地状态、业务动作和外部数据更新。

## 问题：一次点击应该走到哪里

OpenUI 天气卡片里有两类按钮。`°C / °F` 只修改本地 `$unit`，不发网络请求；点击 Tokyo 则通过 `@ToAssistant("Show Tokyo weather")` 回到 host，重新请求一份 OpenUI Lang：

![OpenUI Tokyo action result](../public/media/openui-weather-tokyo-action.png)

A2UI 天气卡片里的 London 按钮会发出一个带 `surfaceId`、`sourceComponentId` 和 city context 的 action。Python server 查出新的 mock weather，再返回一轮 A2UI messages，Flutter Surface 最终变成 London：

![A2UI Flutter London data-only update](../public/media/a2ui-data-only-london.png)

表面上都是“点按钮，换城市”，实际路径差异很大：

|动作|OpenUI weather demo|A2UI Flutter weather demo|
|:---|:---|:---|
|切换 °C / °F|`$unit` + state field，runtime 本地完成|本次 demo 未实现本地单位切换|
|选择城市|`@ToAssistant` 发起新一轮 UI response|A2UI action 经 A2A 回到 server|
|返回结果|重新生成完整 OpenUI program|只发送 `updateDataModel(path=/weather)`，更新 13 个 bindings|
|本次 renderer|React state/runtime|Flutter `SurfaceController`|


## 本地状态：OpenUI Store 和 A2UI Data Model

OpenUI 可以在 program 中声明变量：

```text
$unit = "c"
hero = WeatherHero(..., $unit)
units = UnitToggle("Temperature unit", $unit)
```

`UnitToggle` 点击后通过 state field 写入 OpenUI runtime store。`WeatherHero`、`HourlyForecast` 和 `DailyForecast` 订阅同一个 `$unit`，所以 26°C 可以直接变成 79°F。整个过程留在浏览器，不需要 assistant 或天气 provider 参与；host 还可以通过 `onStateUpdate` 观察并持久化这份状态。OpenUI Lang 另外提供 `@Set` / `@Reset`，供生成的 Action 修改同一类 runtime state。

实验也暴露了 state lifetime 的细节。用户先切到 °F，再点击 Tokyo。新的 OpenUI response 又声明了 `$unit = "c"`，画面回到 Celsius；右侧 host trace 保存的最后一份 state snapshot 仍是 `{"$unit":"f"}`。换句话说，program declaration 和 host persistence 是两层状态，应用需要决定新 response 到来时采用 reset、merge 还是 hydrate。

A2UI 把状态集中在 Surface 的 Data Model。组件属性可以绑定 path：

```json
{
  "id": "temperatureText",
  "component": "Text",
  "text": { "path": "/weather/temperatureLabel" }
}
```

后续 `updateDataModel` 修改 `/weather/temperatureLabel`，订阅该 path 的 native component 就可以重新构建。TextField、selection、validation 等交互也能围绕 Data Model 组织，客户端还可以注册 function 处理格式化或派生值。

后面的天气实验会复用这棵 component tree，只通过 Data Model 写入 London snapshot，再观察 payload、rebuild 和 UI state。

## 业务动作：模型不必参与每一次点击

OpenUI 的 `@ToAssistant` 适合“换个城市”“继续解释”“给我另一组方案”等对话动作。它把一段 human-friendly message 交给 host，再由应用决定如何开始下一轮 assistant response。

而真实的 `Submit reservation request` 需要另一种路径。OpenUI 的 `Mutation()` 可以注册 host 提供的 tool，按钮通过 `@Run(mutationRef)` 执行；应用也可以在 `onAction` 中接管自定义行为。表单值、用户身份、库存和权限交给业务 API，返回成功或失败后再更新 UI。模型可以参与生成说明，不负责决定订单是否真的成立。

A2UI action 本身是一个 domain event。本次 London action 的主要内容如下：

```json
{
  "action": {
    "name": "select_city",
    "surfaceId": "weather",
    "sourceComponentId": "londonButton",
    "context": { "city": "London" }
  }
}
```

server 可以直接处理 `select_city`，也可以把它交给 agent。A2UI 关心 action 来自哪个 Surface、哪个 component、带了什么 context；授权、幂等、业务校验和最终结果依旧属于产品后端。按钮是否进入 LLM，由外围 Agent runtime 和业务流程决定。

因此，一条可控的 action flow 通常要拆成三种：

1. UI state，例如 tab、展开收起、临时 selection，留在 local runtime。
2. Deterministic business action，例如刷新、下单、审批，调用明确的 tool/API。
3. Intent continuation，例如换方案、解释结果、重新组织界面，再回到模型或 agent。

把所有按钮都送回 assistant，响应慢且业务边界模糊；把所有状态都写在组件内部，下一轮 UI 又很难恢复。框架提供的是表达能力，应用仍需要给每个 action 选择正确的执行层。

## 外部数据：订单状态自己变化了怎么办

天气和订单都有一种常见情况：用户什么都没点，数据已经在服务端变化。这个问题能把 OpenUI 和 A2UI 的 runtime 取向看得更清楚。

OpenUI 的 `Query()` 由 host `toolProvider` 执行。它可以在 streaming 结束后自动查询，也可以带 refresh interval：

```text
order = Query("getOrder", {id: $orderId}, {status: "loading"}, 30)
refresh = Button("Refresh", Action([@Run(order)]))
```

假设 `statusText` 绑定到 `order.status`，runtime 每 30 秒重新调用 `getOrder` 后即可更新组件，不需要重新生成布局。轮询适合刷新频率低、实时性要求有限的场景；更高频的数据通常需要 push 或更明确的失效策略。

`@Run(order)` 可以主动 invalidation/refetch；query args 中引用的 state 变化时也会重新查询。这套能力方便，但需要产品补上 query policy。例如搜索框若把每次输入都直接绑定给 query args，用户输入一个字符就可能发一次请求；debounce、cancellation、cache、retry 和权限仍由 runtime/tool provider 一侧设计。OpenUI 把 query 放进 UI program，业务系统继续决定这些请求策略。

A2UI 的处理方式更接近服务端状态同步。初次 response 建立 Surface 和 data bindings，订单状态变化后，server 可以再发：

```json
{
  "version": "v0.9",
  "updateDataModel": {
    "surfaceId": "order-detail",
    "path": "/status",
    "value": "shipped"
  }
}
```

这条消息可以来自一条持续的 SSE/WebSocket/A2A stream，也可以由 App 自己轮询后送进 `SurfaceController`。A2UI 定义的是 Surface update message，数据从哪里来、transport 是否长连接、断线如何恢复，需要外围 runtime 和产品架构补齐。

如果 component tree 已经绑定 `/status`，这次只推数据即可；订单增加一块退款表单、物流节点列表发生结构变化时，再发 `updateComponents`。这正是 Data Model 与 component definitions 分离后可以获得的更新粒度。

## 复用布局，只更新数据

把这个问题带回天气 Demo：UI 已经完成生成和渲染，后续拿到新数据时继续使用现有布局。OpenUI 保留同一个 Renderer 和 Query program，A2UI 保留同一个 Surface 和 66-component tree。

### OpenUI：Query 继续使用现有 Renderer

OpenUI weather demo 增加了 Query mode，并接入真实的本地 HTTP `toolProvider`。2 秒测试间隔下，`Query("getWeather", ...)` 完成了自动 polling、`@Run` 手动刷新和 city args 变化后的 Tokyo 查询；同一个 Renderer 收到新 response 时，Query cache 和 `$city` state 继续保留。一次主动制造的 503 会进入 `tool-error`，画面保留最后一份 Tokyo 数据。这里的 cache 属于内存态，页面 reload 或 Renderer unmount 后需要 host 另行恢复。

![OpenUI Query runtime experiment](../public/media/openui-query-runtime.png)

### A2UI：Data Model 更新现有 Surface

A2UI weather demo 把 13 个天气文本改成了 `/weather/...` data bindings。首次 response 仍然建立 Surface、Data Model 和 66-component tree；London action 后，server 只发送一条 `updateDataModel(path=/weather)`。wire payload 从全量重发基线的 7,117 bytes 降到 654 bytes，减少 90.8%。

这里需要区分传输和 renderer rebuild。Flutter runtime 没有收到新的 component update event，但 `/weather` 的变更仍让 66 个 widget ID 重新 build。配套 runtime probe 的 scroll offset 保持在 632，focus、TextField State 和本地输入也都保留下来。A2UI 省掉了 component contract 的重发，现有 Flutter renderer 仍会执行 reactive rebuild。

这两项结果和前面的机制能够对应起来：OpenUI Query 把数据请求、cache 和刷新放在 Web runtime；A2UI data patch 把数据同步交给外围 transport 和 server，native renderer 订阅 Data Model。两条路径都复用了已经生成的 UI 结构。后续还可以继续测 OpenUI 的 retry/cancellation policy，以及 A2UI leaf patch 的 frame time 和多平台一致性。

## 从 PMF 看 runtime 应该放在哪里

OpenUI 把 parser、state、expression、Query/Mutation 和 React rendering 收到 Web runtime。它适合快速生成一次性的交互内容，例如 chat 里的临时报表、筛选表单和可继续探索的结果卡片。团队可以跟随 Web 服务快速发布 component library，但可能也要承担一些 model output、浏览器 runtime、业务数据来源和 state restoration 的观测成本。

A2UI 把 Surface、Data Model、component registry 和 action dispatch 放到客户端 runtime。它更适合多端的 native UI、长期存在的 Agent Surface。对应成本是 catalog 和 renderer 要跟着 Android/iOS/Flutter/Web 分别维护，旧客户端能力还会反过来限制 agent 可以生成什么。

Thesys C1 这类 Web 产品可以让服务方统一升级 OpenUI runtime，用户刷新页面即可拿到新版本；而类似 Flutter 的 A2UI native 路线通常要跟随 App 发版。

最后我们简单列举下面三个场景来帮助判断：

- **Chat 中临时生成一张可筛选报表**：Web 是主要平台，结构变化多，OpenUI 的组合和 Query/Mutation 更顺手。
- **移动端订单详情持续接收一单同城闪送的状态**：UI 需要 native component、稳定 identity 和 data patch，A2UI 的 Surface/Data Model 更自然。
- **固定天气卡片只换几项数据**：两套 runtime 都显得偏重，预定义组件加普通 API 往往更快落地。


## 参考资料

- [OpenUI Interactivity @ OpenUI](https://www.openui.com/docs/openui-lang/interactivity)
- [OpenUI Queries and Mutations @ OpenUI](https://www.openui.com/docs/openui-lang/queries-mutations)
- [A2UI Data Flow @ A2UI](https://a2ui.org/concepts/data-flow/)
- [A2UI Transports @ A2UI](https://a2ui.org/concepts/transports/)
