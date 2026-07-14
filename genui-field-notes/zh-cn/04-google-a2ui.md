# Google A2UI 及其生态

本章范围限制在 A2UI 这套协议化表达，不展开 Google Research 在 AI Mode 里展示过的 Dynamic View。A2UI 官方给自己的定义直接明了：

> A2UI (Agent to UI) is a declarative UI protocol for agent-driven interfaces.

官方文档进一步说明，A2UI 让 agent 生成 JSON messages，由客户端使用自己的 native components 渲染到 Web、mobile、desktop 等平台上，同时避免执行任意代码。这个定义里有三个关键词：`declarative`、`messages`、`native components`，即它的主要路线是把“想展示什么”的 Intent 整理成结构化数据，再交给宿主应用里的 renderer；而模型临时写前端页面代码、或者把一段 iframe 塞进宿主应用，都属于其对比过的替代路线，并非 A2UI 要做的事情。

## 核心概念/核心对象

读 A2UI 文档时，先关注这几个核心概念会轻松很多：

- `Surface`：一块可以被 agent 创建、更新或删除的 UI 区域。
- `Catalog`：客户端声明自己支持哪些组件，以及这些组件有哪些参数。
- `Component`：具体 UI 元素，例如 `Text`、`Button`、`Card`、`TextField`。
- `Data Model`：客户端保存的一份状态树，组件可以通过 path 绑定其中的数据。
- `Action`：用户点击、提交、选择之后回传给 agent 或服务端的行为入口。

A2UI 把这些对象拆解开后，生成式 UI 就不再只是“一段会被渲染的文本”，它更像一组按顺序到达的更新：先创建 surface，再补组件结构，再填数据，后续用户动作继续回到同一条链路里。

![A2UI 端到端数据流](../public/media/a2ui-end-to-end-data-flow.webp)

*A2UI 端到端数据流示意：服务端流式下发、客户端渲染、用户动作回传，再进入下一轮更新。图中沿用了早期协议命名。*

## 生成时输出什么

按照当前文档里的 v0.9 / v0.9.1 形态，A2UI 的 server-to-client 输出主要围绕四类消息：`createSurface`、`updateComponents`、`updateDataModel` 和 `deleteSurface`。官方站点目前把 v0.9.1 标为 Current，v1.0 仍放在 Candidate 下；下文 demo 使用的是 Flutter GenUI 当前支持的 A2UI v0.9 路径。

官方 Data Flow 页面把 A2UI 输出描述成一串 JSON messages；**流式场景**里，这些 message 经常可以**按 JSONL 一行一个对象地传输**。如果把这些 messages 包成一个普通 JSON array，等完整 UI 生成完再一次性返回，A2A 的非流式调用或普通 HTTP JSON 在复杂场景里就很容易变成长等待，甚至撞到网关或平台超时。所以很明显 A2UI 适合用 A2A streaming、SSE 或 WebSocket 这类通道一条一条推 message，让客户端先创建 surface、再补数据和组件。

一个最小化的形状大概是这样：

```jsonl
{"version":"v0.9","createSurface":{"surfaceId":"weather","catalogId":"https://a2ui.org/specification/v0_9/basic_catalog.json"}}
{"version":"v0.9","updateDataModel":{"surfaceId":"weather","path":"/","value":{"city":"Singapore","temperature_c":26}}}
{"version":"v0.9","updateComponents":{"surfaceId":"weather","components":[{"id":"root","component":"Column","children":["title"]},{"id":"title","component":"Text","text":{"path":"/city"}}]}}
```

这里和 OpenUI 的差异会很明显。OpenUI 的输出更像：

```txt
root = Stack([header, filterCard, restaurantSection])
header = Card([headerTitle], "clear")
headerTitle = TextContent("Reserve a Table", "large-heavy")
```

A2UI 则选择了更明确的 JSON envelope。组件结构是一组 flat component list，每个组件有自己的 `id`，父组件通过 child id 引用子组件。这样做的好处是：更新一个组件、追加一组数据，都可以变成局部 message，省掉重发整棵深层嵌套树的成本。

这部分也为后面的第 6 章做了铺垫：如果只问“模型生成了什么”，OpenUI 和 A2UI 已经给出了两种很不同的答案。OpenUI 更像 DSL 程序；A2UI 则更像传统 BDUI 消息格式加上流式化的新外壳。

## 跨端是 A2UI 的特色

A2UI 的文档把 portability 放在很前面：同一份 agent response 可以在 Web、mobile、desktop 上由不同 renderer 映射到本地 UI。Flutter GenUI 的 README 也写到：

> The Flutter Gen UI SDK uses the A2UI protocol

Android 和 iOS 原生 App 通常不适合动态下发可执行代码（尤其是原生代码），可行路径通常是 JavaScript 执行环境，或内嵌一个自实现的解释器（如 Lua），这对 OpenUI 是比较大的限制。所以 A2UI 服务端或 agent 只下发声明式数据，renderer 在本地把这些数据映射成 Flutter widget、SwiftUI view 或 Jetpack Compose composable。

它给移动端 App 指了一条比较清楚的工程路径：UI 可以动态组合，但代码和组件实现仍然属于客户端。相比之下，OpenUI / Thesys C1 当前更自然地落在 Web / React 这条线上；要让同一套 OpenUI Lang 很自然地映射到 Kotlin / Swift 原生组件，不仅仅是解释器层面的实现复杂度，还会面对更多语义和平台 runtime 对接问题。

当然，A2UI 也不会凭空解决跨端一致性。catalog 一旦变复杂，不同平台 renderer 的组件行为、布局细节、无障碍、主题和错误恢复都要分别测试。

## 周边生态

A2UI 自己只是 UI payload / schema / renderer contract，真正接入到产品时，还需要周边生态配合。

一个常见的搭配是 AG-UI。AG-UI 更像 runtime/event pipe，负责 agent execution、文本流、tool call、state、user input 等事件。除此之外，一个名为 CopilotKit 的库又能把 AG-UI 和 A2UI 串进 React / Next 这类前端应用里。这样看会更清楚：A2UI 负责“要显示什么 UI”，AG-UI 负责“agent 和 UI 怎样持续通信”，CopilotKit、Flutter GenUI 这类项目负责把它接进具体应用框架。

## Flutter 天气卡片 demo

为了看 A2UI 在移动端实际长什么样，我之前做了一个本地 Flutter 天气 demo。这个 demo 里的服务端同样不是临时生成 Flutter 代码；Flutter App 通过 `genui` / `genui_a2a` 连接一个 Python A2A server，服务端根据 mock weather 数据返回文本和 A2UI data parts，Flutter 端再用 `SurfaceController` 渲染成原生 widget。

![Flutter GenUI weather card demo](../public/media/flutter-genui-weather-card.png)

这个 demo 的链路可以压成几步：

```text
Flutter App
  -> A2uiAgentConnector
  -> Python A2A weather server
  -> mock weather lookup
  -> text + A2UI data parts
  -> SurfaceController
  -> Flutter widget tree
```

客户端发起请求时，会把 A2UI capability 放进 A2A message metadata 里，告诉服务端自己支持 v0.9 basic catalog：

```json
{
  "metadata": {
    "a2uiClientCapabilities": {
      "v0.9": {
        "supportedCatalogIds": [
          "https://a2ui.org/specification/v0_9/basic_catalog.json"
        ]
      }
    }
  }
}
```

这里的 `catalogId` 可以先理解成这块 surface 使用的“组件词典”。客户端通过 `supportedCatalogIds` 声明自己认识这套 basic catalog，服务端在 `createSurface.catalogId` 里选用同一个 ID；后续 `updateComponents` 里的 `Column`、`Card`、`Button`、`Icon` 等组件名和属性，就都按这套 catalog 来解释。它不是让客户端动态下载代码，而是让两边对齐同一套可渲染组件和参数约定。

服务端最终返回 4 个 part。第一个是普通文本，后面三个是 A2UI data part。A2A 外层的 task / status 字段这里先省略，只看 final message 里的 `parts`：

```json
{
  "parts": [
    {
      "kind": "text",
      "text": "Singapore: Mostly cloudy, 26°C (feels like 29°C)."
    },
    {
      "kind": "data",
      "data": {
        "version": "v0.9",
        "createSurface": {
          "surfaceId": "weather",
          "catalogId": "https://a2ui.org/specification/v0_9/basic_catalog.json",
          "sendDataModel": true
        }
      }
    },
    {
      "kind": "data",
      "data": {
        "version": "v0.9",
        "updateDataModel": {
          "surfaceId": "weather",
          "path": "/",
          "value": {
            "city": "Singapore",
            "country": "Singapore",
            "temperature_c": 26,
            "condition": "Mostly cloudy",
            "humidity": 82,
            "wind_kph": 13,
            "feels_like_c": 29
          }
        }
      }
    },
    {
      "kind": "data",
      "data": {
        "version": "v0.9",
        "updateComponents": {
          "surfaceId": "weather",
          "components": [
            {
              "id": "root",
              "component": "Column",
              "align": "stretch",
              "children": ["heroCard", "cityCard"]
            },
            {
              "id": "heroCard",
              "component": "Card",
              "child": "heroBody"
            },
            {
              "id": "temperatureText",
              "component": "Text",
              "variant": "h1",
              "text": "26°C"
            },
            {
              "id": "londonButton",
              "component": "Button",
              "variant": "borderless",
              "child": "londonButtonChild",
              "action": {
                "event": {
                  "name": "select_city",
                  "context": {
                    "city": "London"
                  }
                }
              }
            }
          ]
        }
      }
    }
  ]
}
```

最后这个 `updateComponents` 才是 UI 结构的主要部分。上面的 JSON 为了控制篇幅只截了几个关键 component；本地 demo 的真实 message 里有 66 个 components，组成了天气主卡、城市信息、温度、湿度、风速、舒适度、提醒文本和城市切换按钮。Flutter 侧收到 `CreateSurface`、`UpdateDataModel`、`UpdateComponents` 后，会把消息交给 `SurfaceController`，再由 renderer 从 `root` 开始构建 widget tree。

按钮也走同一套链路。用户点击 London 后，Flutter 发送一个 A2UI action data part，里面带上 action 名称、来源组件和城市参数：

```json
{
  "version": "v0.9",
  "action": {
    "name": "select_city",
    "sourceComponentId": "londonButton",
    "context": {
      "city": "London"
    },
    "surfaceId": "weather"
  }
}
```

服务端识别 `select_city`，查出 London 的 mock weather，再返回新一轮三条 A2UI messages：`createSurface`、完整的 `updateDataModel`，以及包含全部 66 个组件的 `updateComponents`。Flutter 端重新渲染后，主卡变成 London，`londonButton.variant` 也会变成 `primary`。一次完整的交互往返，让我们看到了它继续接收用户动作、更新数据、替换组件的一系列动作。


## 参考资料

- [What is A2UI? @ A2UI](https://a2ui.org/introduction/what-is-a2ui/)
- [Data Flow @ A2UI](https://a2ui.org/concepts/data-flow/)
- [Components & Structure @ A2UI](https://a2ui.org/concepts/components/)
- [Transports @ A2UI](https://a2ui.org/concepts/transports/)
- [Flutter GenUI @ GitHub](https://github.com/flutter/genui)
- [A2UI @ GitHub](https://github.com/google/A2UI)
