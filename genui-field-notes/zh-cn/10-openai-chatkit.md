# OpenAI: ChatKit Widgets

第 5 章介绍 Vercel AI SDK 时，我们提到这是一个很基础的 `Tool Call` 到预设卡片组件的映射，即模型先调用 `getWeather` 之类的 Tool，前端再用约定好的 `<Weather>` 组件渲染 Tool Result。OpenAI 的 ChatKit **Widgets** 基本沿用这套方法，两者的主要差异发生在 UI 这一层，Vercel 直接使用项目里的 React 组件，ChatKit 则提供了一套固定的 Widget Catalog。

所以，我们可以先把 ChatKit Widgets 归入同一条 `Tool Call` 映射路线。需要说明的是 ChatKit 本身提供的是一个聊天产品的外层综合功能，涵盖 Thread、消息流、附件、Action、主题和输入框等，只不过**其中的 Widgets** 功能是我们要讨论的一种预定义组件的 GenUI 路线。

截至 2026 年 8 月，ChatKit 官方推荐新项目使用自建服务端的 Custom Server Integration：前端嵌入 ChatKit Web Component，后端使用例如 ChatKit Python SDK 接入自己的 Agent。此前 ChatKit 也可以直接接入 Agent Builder 发布的 Hosted Workflow；Agent Builder 目前已进入迁移期，官方计划于 2026 年 11 月 30 日关闭该服务，ChatKit 本身继续保留。

## 一张 Widget 由谁完成

如前面所述，ChatKit 的页面很完整，聊天记录、输入框和 Widget 卡片都在同一个界面里。让我们重点先把一张天气卡片的 Widget 的分工写清楚：

```text
ChatKit Widget Catalog + 开发者 Template + 运行时 Data
                         ↓
                    最终 Widget
```

| 部分 | OpenAI 提供 | 开发者完成 |
| --- | --- | --- |
| 聊天外壳 | Web Component、Thread、消息流、输入框和附件 | 嵌入页面、连接 `/chatkit` 接口、设置主题 |
| Widget | Catalog、默认样式和浏览器 Renderer | 选择组件，编排卡片结构和文案 |
| Template | `.widget` 格式、Studio、Python `WidgetTemplate` | 编写模板、Schema、Jinja 数据绑定和条件 |
| 运行时数据 | Tool Call、Thread stream event | 实现 Tool，连接天气、订单等业务数据源 |
| 交互 | Action 事件、loading 状态和更新接口 | 定义 Action 名称、参数与服务端处理逻辑 |

天气卡片的实际链路也可以压缩成五步：用户询问天气，模型选择 `show_weather` Tool，Tool 返回天气数据，服务端调用 `WidgetTemplate.build(data)`，ChatKit Renderer 绘制最终组件树。模型只需要生成 Tool 名称和参数，卡片长什么样由开发者的 Template 决定。

本章采用 Custom Server Integration。`ChatKitServer.respond()` 接收新消息，`ChatKitServer.action()` 处理 Widget 上的点击；两条入口都可以向同一个 Thread 写入流式事件。这个结构把普通回复、Tool Call、Widget 和后续操作放进了同一段聊天记录。

## 全局主题和单张卡片

开发者可以从两个位置调整界面。第一层是 ChatKit 的全局 Theme，它会影响聊天外壳和所有 Widget 的基础风格。本次实验在 `useChatKit()` 中设置暖灰背景、橙色强调色、圆角、密度和字号：

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

第二层是单张卡片的 `.widget` Template。天气卡片里的背景、边框、Padding、横竖排列、图标、指标格和按钮都写在 Template 中。样式入口是 Catalog 组件及其 Props，例如 `Row`、`Col`、`Box`、`background`、`minWidth` 和 `wrap`；这些字段决定 Renderer 最终采用的布局和设计 Token。

为了验证这两层定制能走多远，我用同一份天气数据和 Action 做了一张 Claude-like 天气卡。全局 Theme 处理聊天页面，Template 处理卡片内部。组件的渲染和交互仍由 ChatKit 完成。

<img src="/media/chatkit-weather-claude-like.jpg" width="420" alt="使用 ChatKit Theme 和 Widget Template 制作的 Claude-like 天气卡片" />

*同一套 ChatKit Components，通过全局 Theme 和 `.widget` Template 调整为 Claude-like 风格。*

这个结果只参考了 Claude 的配色与留白。按钮状态、响应式布局和组件实现继续使用 ChatKit。开发者能调整 Catalog 已开放的字段，也要接受 Catalog 对组件形态和样式范围的限制。

## Components 和 Widget Template

ChatKit Widgets 的公开组件大致分成四组：

- 根节点：`Card`、`ListView` 和 `Basic`；
- 布局：`Row`、`Col`、`Box` 和 `Spacer`；
- 内容：`Text`、`Title`、`Icon`、`Image` 和 `Chart`；
- 输入与操作：`Button`、`Input`、`Select` 和 `Form`。

服务端最终交给浏览器的是一棵 JSON 组件树。天气卡片用 `Card` 做根节点，再用 `Row`、`Col` 和 `Box` 组织内容。Vercel Demo 会把 Tool Result 交给完整的 React `WeatherCard`；ChatKit Template 则把这些小组件组装成业务卡片。

`.widget` 文件的外层包含 `version`、`name`、`template` 和输入数据的 `jsonSchema`。`template` 是一段带 Jinja 表达式的 Widget JSON 字符串，例如：

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

服务端调用 `WidgetTemplate.build(data)` 后，Jinja 填入变量并执行条件、循环，最后得到 `WidgetRoot`。这一步不需要再次调用模型。Tool 或应用服务端准备数据，Template 完成组件树组装。

## Studio 模板制作工具

ChatKit Studio 提供了 Gallery 和 Builder，帮助开发者快速可视化理解并制作 `.widget`。它可以从自然语言、mockup、空白文件或已有 `.widget` 开始；也可以同时查看组件结构、Schema、示例数据、实时预览和编译后的 JSON。

![ChatKit Widget Gallery 中的业务卡片、表单和图表](../public/media/chatkit-widget-gallery.jpg)

*Gallery 用航班、购物、会议、天气等业务例子展示 Catalog 的组合方式。*

本次实验选择 Gallery 中的 `weather_current`，再把 San Francisco 改成 Singapore。天气卡用 `flex={1}` 平分三个指标格，用 `minWidth` 和 `wrap` 处理较窄的容器。

![在 Widget Builder 中修改 Singapore 天气卡](../public/media/chatkit-widget-builder-weather.jpg)

*左侧编辑组件、Schema 和示例数据，右侧检查实际渲染结果。*

个人感觉 Studio 可以加快 `.widget` 的制作和预览。它负责导出文件，生产环境再由 `WidgetTemplate` 读取；开发者也可以二次修改这个文件，本章的 Claude-like 版本便采用了这种方式（从蓝色的一个主题改成了橙色）。导出的 Action 只描述事件名称、参数和 loading 行为；查询天气、更新 Widget 等业务逻辑仍然是自己的应用前后端在控制（可以配置 Action 的接收者是前端还是后端）。

## 开源边界：能够确认到哪一步

- ChatKit 的 JavaScript 仓库公开了组件 Props、Theme 类型、React Hook 和 Web Component wrapper；
- Python 仓库公开了 `ChatKitServer`、Widget schema、Template、Thread event、Widget diff 和 Action runtime。
- 浏览器 Renderer 通过 OpenAI CDN 发布，Studio 以在线工具的形式提供。
- 公开仓库目前覆盖前后端接入层，组件 Renderer 和 Studio 属于 OpenAI 托管的部分。

本次实验也检查了浏览器实际下载的 JavaScript 和 CSS，其中包含编译后的组件注册表、默认样式和响应式规则。天气卡片本身依靠 `flex`、`minWidth` 和 `wrap` 适配容器，没有编写断点表达式；Renderer 外层还会用 `ResizeObserver` 观察 Widget 容器，并按 `280`、`355`、`435`、`555`、`755` 和 `955` px 切换响应式规则。组件定义、样式和宽度规则因此都有具体值可以核对。这些证据只能协助解释页面的渲染规则，而 OpenAI 内部源码如何组织，暂无公开资料。

由于 Renderer 和 Studio 的中间流程没有公开源码，本章不再逐个介绍内部对象和事件名，也不根据编译产物补一套流程说明。感兴趣的读者可以直接试用 [ChatKit Studio](https://widgets.chatkit.studio/) 和 [Widget Gallery](https://widgets.chatkit.studio/gallery)，体验组件组合、预览和导出的完整过程。

## 天气卡片 Demo

本次实验使用 `openai-chatkit` 1.6.5、`openai-agents` 0.22.0、`@openai/chatkit` 1.9.0 和 `@openai/chatkit-react` 1.6.1。前端加载 ChatKit Web Component，本地 FastAPI 运行 `ChatKitServer`，Agents SDK 调用真实的 `gpt-5.6`。天气数字使用固定 fixture，避免第三方天气接口影响 Tool、Widget 和 Action 的观察。

![ChatKit 中由真实模型触发的 Singapore 天气卡片](../public/media/chatkit-weather-singapore.png)

*用户发送天气请求后，模型选择 `show_weather`，服务端在同一条 Thread 中推送天气 Widget。*

用户输入 `Show me the weather in Singapore.` 后，模型第一次返回的结构化结果很短。实验日志经过 Agents SDK 规范化后如下：

```json
{
  "tool": "show_weather",
  "arguments": {
    "city": "Singapore"
  }
}
```

天气数据随后由 `show_weather` Tool 从 fixture 中读取：

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

Tool 一边把这份数据交给 `.widget` 模板，一边将结果返回模型。模板生成 `Card` 组件树并写入 Thread；模型拿到 Tool Result 后，又生成了一句 `Here’s the current weather in Singapore.`。所以这一轮实际产生了两个 OpenAI Response：第一段选择 Tool，第二段补充自然语言。

从模型开始到 `show_weather` Tool Call 用了 2,169 ms，到完整 Widget 为 2,874 ms，整轮 Response 在 4,429 ms 完成。这个延迟包含真实模型请求和本地故意增加的约 700 ms loading 状态，数据本身不走远程天气服务。

## 一张 Widget 怎样流式出现

`show_weather` Tool 返回的是一个异步过程。它先 yield loading Widget，稍等后再 yield 完整结果：

```python
async def states():
    yield build_loading_weather_widget(city)

    await asyncio.sleep(0.7)
    snapshot = get_weather(city)
    yield build_weather_widget(snapshot)

await ctx.context.stream_widget(states())
```

ChatKit Python SDK 将两个 `WidgetRoot` 状态转换成 `thread.item.added`、`thread.item.updated` 和 `thread.item.done` 等事件。前端产品代码不用再定义一套天气卡片 SSE 协议，只需让 ChatKit Web Component 消费 Thread stream。

实验中还遇到一个很具体的问题：`Icon.name` 写成 `cloud-sun` 时，页面没有显示图标。查看 ChatKit JS 的官方 API Reference，其将 `LucideIcon` 定义为 ``lucide:${string}``，`ChatKitIcon` 则包含 ChatKit 内置名称和 `LucideIcon` 两部分。因此，可以判断出 `cloud-sun` 与 `lucide:cloud-sun` 会进入两张不同的图标表。

`.widget` 经过 `WidgetTemplate.build()` 后会转换成 `DynamicWidgetRoot`。这个类型允许模板携带额外字段，构建过程也没有使用 `.widget` 中的 `jsonSchema` 校验每个图标名称，因此 `cloud-sun` 顺利进入了浏览器。Renderer 收到名称后再进行分流：无前缀名称进入 ChatKit 自带图标表，`lucide:` 前缀则进入 Lucide 图标表。ChatKit 自带图标表中没有 `cloud-sun`，所以第一次渲染得到了一块空白；改成 `lucide:cloud-sun` 后，Renderer 找到对应的 Lucide chunk，图标才正常显示。

这个问题说明 `.widget` 的 Schema、Python 模板构建和浏览器 Renderer 是三道不同的检查。字段通过前两道检查，只代表 JSON 结构能够继续传递，组件中的枚举值最终还要由 Renderer 识别。算是个可以帮助大家避免的小坑吧。

## 组件里的按钮如何进行下一步

天气 Widget 底部有 Singapore、London、Tokyo 和 Refresh 四个按钮。每个按钮都携带一份 `ActionConfig`：

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

用户点击后，ChatKit 把 Action 发给 `ChatKitServer.action()`。这次实验选择直接读取 London fixture，先替换成 loading Widget，约 450 ms 后再替换为 London；Tokyo 和 Refresh 亦采用同一套流程。三次 Action 的 `invokes_model` 都是 `false`，Action 前后的模型运行次数保持不变。

服务端还向 Thread 写入了一条 `HiddenContextItem`，记录用户已经选择 London。下一次用户发送消息时，模型便能从历史上下文中读到这次操作。`action()` 也可以改成调用模型或写入一条新消息；本次实验采用的是本地更新 UI，并补充一条隐藏上下文。

## 平台和语言边界

一方面，由于 Widget 是普通 JSON，任意后端语言和框架都可以生成相同的组件树。官方的 `.widget + Jinja + WidgetTemplate` 工具链目前放在 Python SDK 中；公开的 Node.js 包里尚未看到对等的模板编译器和 Custom Server runtime。Node.js 项目一般需要用 TypeScript 函数构造 Widget JSON，或者自行接入模板引擎。ChatKit Renderer 最终读取的是浏览器收到的组件树。

另一方面，客户端是一套 Web Component，因此除了浏览器外，其他平台可以嵌入 Web 内容，理论上也可以自行实现这份 Widget Catalog 的 Renderer。OpenAI 暂未提供与 A2UI Flutter、AGenUI Android 相似的原生 Renderer，因此 ChatKit 的客户端落地仍明显偏向 Web。

## 一点判断

个人认为，ChatKit Widgets 最大的参考价值，来自 ChatGPT 长期积累的大量真实使用数据。合理推断 OpenAI 能从早期的使用场景中判断聊天窗口需要展示什么、用户经常执行哪些操作，再据此整理出一套相对合理的组件库。开放式 GenUI 框架自建 Catalog 时，参考这份组件库定义是有其产品化价值的，至少你不用从 `Text + Button` 测起。

另外，由于 ChatKit Renderer 与 Studio 由 OpenAI 托管发布，官方 Custom Server 工具链目前也明显偏向 Python，后续升级存在几个具体风险。举个例子：目前官方页面直接加载没有版本号的 `chatkit.js`，也未提供固定 Renderer 版本或自行部署的入口；一旦组件参数、响应式断点或默认样式发生变化，已经上线的 Widget，以及重新打开的历史 Widget，也要跟着验证，核心业务长期依赖它会增加维护和回退的成本。

但反过来看，这套托管方案省去了组件实现、聊天外壳和 Thread runtime 的前期工作，用来快速验证一个 Agent Chat 产品是否有人使用，以及 GenUI 的介入给产品增加多少价值，倒是十分合适。

## OpenAI 体系里的其他 GenUI 相关技术

### MCP Apps

MCP 原本负责连接模型与外部数据、工具，MCP Apps 在这条链路上增加了 UI Resource 和 iframe 通信协议。MCP Tool 通过 `_meta.ui.resourceUri` 指向开发者提前写好的 HTML App；在 ChatGPT 中，OpenAI 的 Host 使用 sandbox iframe 加载它，再通过 MCP Apps Bridge 传入 Tool Input、Tool Result 和主题、尺寸等信息。

模型只需要选择 Tool 并填写参数，页面布局和交互代码均已写在 HTML App 中。因此，MCP Apps 更接近“Tool + Web View”，它为 ChatGPT 中的第三方交互界面提供了统一的挂载方式，本身没有定义一套让模型编排组件的 UI 语言。

### Structured Outputs

Structured Outputs 可以用来实现另一种更接近 A2UI 的实验：开发者先将 `Card`、`Text`、`Button` 等预定义组件写成递归 JSON Schema，再让模型生成符合 Schema 的组件树，客户端按照节点名称映射到 React 等平台组件。OpenAI 官方 GitHub 样例还会流式接收 Function Arguments，使用 `partial-json` 解析尚未结束的 JSON，从而逐步显示已经生成的部分。这里的组件库、样式、Renderer、状态和 Action 都要由开发者实现；Structured Outputs 主要负责约束模型的输出结构。它算是提供了自建 GenUI 的一个起点，但距离 A2UI、OpenUI 这类已经补齐协议和运行时的方案还有不少工程工作。

## 参考资料

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
