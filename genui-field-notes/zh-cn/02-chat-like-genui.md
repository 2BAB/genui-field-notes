# Chat-like GenUI 与其他形态

本文延续我之前的中文博客 [《A2UI、AG-UI，以及聊天框之外的 GenUI》](https://2bab.me/zh/blog/2026-05-15-a2ui-agui-surface-spec/) 里的几个观察，后半段再加入 Google Research 的 [Generative UI 案例](https://research.google/blog/generative-ui-a-rich-custom-visual-interactive-user-experience-for-any-prompt/)。

GenUI 领域里，目前很多讨论焦点会先落到 chat-like GenUI。这里的 chat-like 可以先理解成一种产品边界：用户在一次对话里提出需求，系统返回一段有限的 UI，用户再通过按钮、表单、follow-up action 或继续提问往下走。博文里我记录过这个现象：

> 现在 A2UI 和 AG-UI 的重心仍然很明显地落在 **chat-like style** 上

现在回头看，这里面的商业诉求是很明显的，即如何跟世界的焦点更加重合。但这节我们更关心的是另一个角度，也是技术田野调查应该看的：Chat-like GenUI 可以把生成式 UI 的复杂度压在一次对话、一张卡片、一个 panel 或一段 response 里，是一个很好的起点。

## 一次对话里的复杂度

一个 chat-like GenUI response 通常不需要生成完整 App，更常见的形态是推荐列表、对比表格、信息卡片、确认按钮、图表。对不少 AI Native 产品来说，这个范围很舒服：UI 的生命周期短，状态不会页面，用户接受度快，例如把它理解成一种 markdown 的复杂扩展。（注：这里虽是个技术比喻，但其实普通用户就是不在意你这里用的什么技术，所以认知上就是一种更顺手的丰富扩展）

而这，会直接影响工程实现：组件可以提前定义，布局可以限制在少数几种组合里，action 也可以先从低风险动作开始，比如“换几个选项”“展开更多信息”“把这个选择发回 assistant”。当单次 response 的复杂度不高时，上层的行业 predefined components 的约束就足够产生一个可用的体验。

C1、OpenUI、A2UI、AG-UI 这些方向虽然方向可能不同，但很多 demo 都在做类似的事：先给出 component catalog、schema、action 类型和 style preset，再让模型在这个集合里组装。模型负责的是“在边界内组合”，产品界面的主结构仍然掌握在宿主应用手里。

## Schema 和 Runtime

A2UI / AG-UI 这组例子适合放在这里做一个轻量参照。我之前把它们的关系概括成：

> A2UI 更像 payload/schema，AG-UI 更像 runtime pipe。

这个区分可以帮助理解 chat-like GenUI 为什么容易成为早期落点。A2UI 关心 agent 要展示什么 UI：用哪些组件、绑定哪些数据、暴露哪些动作。AG-UI 关心 agent 和前端怎么持续通信：文本怎么流出来，工具调用怎么进入 UI，用户确认怎么回到 agent，状态更新怎么传给前端。

放在 chat-like 场景里，这两层都比较容易收敛。payload 不需要覆盖完整产品的信息架构，runtime 也主要围绕一次任务展开。它们要处理的状态、组件和 action 数量有限，测试和回滚也更容易做。

## 聊天框之外

聊天框只是一个入口。那篇文章里我还写过另一个判断：

> ...新闻 App 仍然需要阅读页，播客 App 仍然需要单集页介绍，杂志仍然需要专题...

这类场景更接近一种 general GenUI 的形式。问题从“一轮对话里生成一段结果”，扩展成“让原有产品里的内容表面理解内容、状态和用户意图”，然后再动态组织布局、推荐、评论、分享、广告、延伸阅读和行动入口。

Google Research 在 2025-11-18 发布的 [Generative UI 文章](https://research.google/blog/generative-ui-a-rich-custom-visual-interactive-user-experience-for-any-prompt/) 里，把这个形式推得更远。原文说，这套实现会动态创建 visual experiences 和 interactive interfaces，例子包括 `web pages, games, tools, and applications`，并根据任意 question、instruction 或 prompt 自动设计和定制。这个组件或技术称之为 **Dynamic View** ，Google 的说法是 Gemini 会为每个 prompt 设计并编写 `a fully customized interactive response`；实现部分则写明使用 Gemini 3 Pro，并加上 tool access、system instructions 和 post-processing。因此，这里我们把它理解成上文讨论的更自由的 GenUI 方向。

![Google AI Mode dynamic view example](../public/media/google-ai-mode-rna-dynamic-view.webp)

*图源：Google Research，文章中的 AI Mode / dynamic view 示例视频。*

这个方向当然更接近“自由”的 GenUI，但从外部可见的产品形态看，它还没有变成一个全量实验后的通用入口。至少在我当前能打开的 Google Search + AI Mode 里，未体验到文章示例里那种根据问答生成完整 Dynamic View 的能力。能稳定看到的，还是 Google 搜索页里更传统的动态组件：比如世界杯查询会出现赛程、积分榜、淘汰赛、球员数据这些模块。

下面两张截图能说明这个差异。同样围绕世界杯信息，AI Mode 更像把结果渲染成一张 Markdown table；Google Search 的普通结果页则已经有明确的垂类 UI，包括 tab、淘汰赛树、积分榜和球员数据。

![Google AI Mode renders World Cup standings as a Markdown-like table](../public/media/google-ai-mode-world-cup-md-table.png)


![Google Search World Cup results page with structured sports UI](../public/media/google-search-world-cup-ui.png)


这条线值得一看，它可以先用传统 BDUI 的方式工作，例如后端根据 query 识别世界杯、天气、股票、航班、菜谱等垂类，再下发一组受控组件。外加传统 ML / 搜推系统决定哪些模块出现、怎么排序、哪些数据更可靠。这里的 UI 已经是动态的，只是动态性主要来自严格的结构化数据、业务模板和搜推系统。

LLM 介入后，这条路线可以逐步加自由度，但 General GenUI 的落地难度肯定会明显上升。页面生命周期更长，状态可能跨页面保存，设计系统要持续约束模型输出，测试也不再只看某一次 response 是否合理。产品团队还要回答一个更麻烦的问题：哪些部分可以生成，哪些部分必须稳定，哪些动作需要明确权限和回滚。

因此，chat-like GenUI 更像一个合适的观察入口。它把生成式 UI 的问题压到一个可控范围内：有限组件、有限状态、有限 action、有限生命周期。等这些东西在一次对话里能稳定工作，再往完整页面、原生 App 和更 general 的内容表面扩展，或许问题才会真正变成 UI expression layer 和 UI runtime 的长期设计。

## 平台和技术选项

最后，聊聊平台技术和选择。现在很多 AI Native 产品明显更偏 Web Frontend，一个重要原因是 Web 对“动态性”的限制更少；而 GenUI 在多平台考量上就会有一些受阻，主要是 Android 和 iOS 原生 App 都不能随便动态下发可执行代码，如果想在手机上做 GenUI，通常只能走受控组件、BDUI，或者 RN 这类更接近 Web runtime 的方案。因此，多数东西先在 Web 试点是和文初的思路相呼应：它们都是一种从更局部的开始，找到合适的技术落地——chat-like 就是一种。当然，过去也有不少电商 App 首页长期使用 RN 或其他动态化框架来做活动位和瀑布流里的 Cell，这条经验在 GenUI 里仍然有参考价值。


## 参考资料

- [Generative UI: A rich, custom visual interactive user experience for any prompt @ Yaniv Leviathan, Dani Valevski, Vishnu Natchu, Yossi Matias](https://research.google/blog/generative-ui-a-rich-custom-visual-interactive-user-experience-for-any-prompt/)
- [A2UI、AG-UI，以及聊天框之外的 GenUI @ 2BAB](https://2bab.me/zh/blog/2026-05-15-a2ui-agui-surface-spec/)
