# AGenUI：A2UI 的 Android 原生实现

第 4 章的天气实验使用 Flutter GenUI Renderer 消费 A2UI 消息。本章沿用同一套 Weather Server 和 A2UI 输出，只把客户端替换为 AGenUI Android SDK，看看这份界面描述能否直接渲染成 Android 原生 View。

AGenUI 项目同时提供 Android、iOS 和 HarmonyOS Renderer，不过本章只讨论并实际验证其中的 Android 实现。iOS 与 HarmonyOS 仅作为项目结构的一部分简单提及，不作实验结论。

## 在 A2UI Basic Catalog 之上增加了什么

AGenUI 1.2.0 的根 Catalog 一共声明了 25 个组件。其中 18 个来自 A2UI Basic Catalog；SDK 增加了 `Table`、`Carousel`、`Web` 和 `RichText`；`Chart`、`Markdown` 与 `Lottie` 则是 Playground 中注册的自定义组件示例。因此，诸如 Lottie 并未绑定在基础 SDK 里，应用可以按照同样的注册方式选择自己的实现和依赖。

而样式上是另一个明显的扩展，AGenUI 给组件加入了一套接近 CSS 的 Styles，覆盖尺寸、margin、padding、gap、Flex、定位、颜色、圆角和阴影等属性，并提供 Design Token 与暗色模式接口。下面截取一段官方 Playground 的 `Card` 配置：

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

这些布局字段在共享 Core 代码库中（C++）交给 Yoga 计算。Yoga 是 Meta 维护的一套开源跨平台布局引擎，实现了接近 Web Flexbox 的布局规则；React Native 也使用它处理跨平台布局。AGenUI 将同一棵组件树转换成 Yoga Node，先计算每个节点的位置与尺寸，再把结果交给 Android、iOS 和 HarmonyOS 的平台 Renderer。

只使用 Basic Catalog 字段时，同一份输出具备跨 Renderer 的基础；使用这些 Styles 和扩展组件后，Agent 生成的内容便会逐渐依赖 AGenUI Catalog。实际上就是输出端获得更细的视觉控制，客户端也需要认得相同的样式和扩展组件去做深度定制。

它还把流式解析做得更细。外层 `updateComponents` 尚未完全闭合时，Core 已经可以抽取其中完整的组件对象；`Text`、`Markdown` 或 Data Model 中的长字符串还可以转换成内部增量更新，让文字提前出现。这里的 `textChunk` 与 `appendDataModel` 属于 AGenUI 客户端内部消息，服务端继续发送标准 A2UI 内容。

## A2UI 消息渲染到 Android View

AGenUI 的主要身份是一套 A2UI v0.9 Renderer SDK。A2UI 负责 `Surface`、Component、Data Model 和 Action 的消息合约，AGenUI 则接住这些消息，在客户端创建和更新界面。至于消息走 SSE、WebSocket、A2A 还是应用已有的长连接，继续由宿主 App 决定。

Android SDK 留给宿主的流式入口很简单，网络层每收到一个 chunk，便把它送进 `SurfaceManager`：

```java
surfaceManager.beginTextStream();
for (String chunk : responseChunks) {
    surfaceManager.receiveTextChunk(chunk);
}
surfaceManager.endTextStream();
```

共享的 C++ Core 紧接着完成协议解析、Data Model 绑定、组件树维护、Yoga 布局和字段 diff；JNI 将结果交给 Android Renderer，最后创建 `TextView`、`CardView` 等原生 View。Surface 创建完成后，宿主只要把它的根容器加入当前页面：

```java
public void onCreateSurface(Surface surface) {
    container.addView(surface.getContainer());
}
```

Android 仍然会执行自己的 measure / layout。AGenUI 提供的 `YogaAbsoluteLayout` 根据 Core 的计算结果摆放原生 View，最终承载交互与绘制的仍是 Android 控件。这套 Core 也被 iOS 和 HarmonyOS Renderer 复用，三端分别接到 UIKit 与 ArkUI；自定义视觉组件依然需要各平台提供自己的实现。

## 换掉 Flutter 客户端

本次实验直接复用了第 4 章的 Python A2A / A2UI Weather Server。Mock 天气数据、A2UI v0.9 消息和服务端 Action 处理均保持原样；Android App 补上 Agent Card 请求、A2A SSE 解析、Surface 容器和 Action 转发。验证环境为 AGenUI 1.2.0、Android 15，以及 Pixel 7 API 35 模拟器。

首次请求返回 `createSurface`、`updateDataModel` 和 `updateComponents`，Android 端据此创建天气卡片。整个过程中没有 AGenUI 专用的消息转换：从 A2A `DataPart` 取出的 JSON 会直接交给 `SurfaceManager`。

![AGenUI Android 渲染 Singapore 天气卡片](../public/media/agenui-android-singapore.png)

*同一份 A2UI Weather 输出由 AGenUI 渲染成 Android 原生 View。截图使用 SDK 默认主题，未额外注册 Theme。*

点击卡片里的 London 按钮后，AGenUI 生成了一条 174-byte Action Event，宿主 App 将其发回同一个 A2A Server。服务端返回一条 656-byte `updateDataModel`，没有再次发送 `updateComponents`；AGenUI Core 重新解析数据绑定和字段变化，已有 Android View 随之显示 London 天气。

![AGenUI Android 原地更新 London 天气数据](../public/media/agenui-android-london-data-update.png)

*London Action 返回后只更新 Data Model，已有 Surface 和 Android View 继续使用。*

同一套服务端先后驱动 Flutter Widget 与 Android View，这个结果比多贴几段 Log 更直接：Basic Catalog 范围内的 A2UI 输出确实具备跨 Renderer 复用的基础。

## 能渲染后，还得看看整体效果

第一次跑出 Android 页面时，一个问题十分显眼：卡片里的内容几乎贴着边缘。继续检查源码便能找到原因，AGenUI 默认 `Card` 样式只声明了宽高和 `16px` 圆角，没有 content padding。Android `CardComponent` 支持把 Styles 中的 padding 映射到 `CardView.setContentPadding()`，但默认值则是 0，匪夷所思。

所以，默认样式适合验证协议与 Renderer，正式产品还要重新注册自己的 Theme 和 Design Token，把卡片留白、组件间距、字号、颜色、暗色模式与无障碍规则补齐。视觉参数全部交给模型临时决定也不划算，应用的基础 Theme 更适合承担稳定的品牌与平台规范，A2UI Styles 再处理确实需要动态变化的部分。

宿主 App 还有一些工作要做。A2A Task、会话连续性和断线恢复属于外围 Transport；Catalog 需要跟随客户端版本管理；`Web`、`RichText` 等高能力组件还要增加域名、URL Scheme、HTML 和跳转策略。接入 AGenUI 也意味着 Android 工程增加 C++、NDK 和 CMake 工具链，这些内容都应该算进维护成本。

## 一点判断

本次实验确认了同一套 A2UI Weather Server 可以同时服务 Flutter 与 AGenUI Android 客户端。AGenUI 最值得观察的部分集中在 Renderer 工程：共享 C++ Core、Android 原生组件、细粒度流式解析、Data Model 绑定和字段 diff。它让 A2UI 进入原生 App 有了一条可以直接运行的路线。

相应地，产品仍要维护 Theme、Android 宿主、Transport 和自己的组件扩展。使用 AGenUI Styles 越多，界面表现越丰富，与这套 Renderer 的绑定也越深。对于已经拥有 Android 原生组件体系，又希望接入 A2UI Agent 的团队，这是一笔比较容易理解的取舍。

## 参考资料

- [AGenUI README](https://github.com/AGenUI/AGenUI/blob/7112bfb8180fb4fd7e27ad6e8808c3da550a117d/README.md)
- [AGenUI Changelog](https://github.com/AGenUI/AGenUI/blob/7112bfb8180fb4fd7e27ad6e8808c3da550a117d/CHANGELOG.md)
- [AGenUI Catalog](https://github.com/AGenUI/AGenUI/blob/7112bfb8180fb4fd7e27ad6e8808c3da550a117d/agenui_catalog.json)
- [AGenUI API](https://github.com/AGenUI/AGenUI/blob/7112bfb8180fb4fd7e27ad6e8808c3da550a117d/docs/API.md)
- [A2UI Basic Catalog](https://a2ui.org/specification/v0_9/basic_catalog.json)
- [Yoga](https://www.yogalayout.dev/)
