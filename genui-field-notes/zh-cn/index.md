# 简介

聊天信息里出现的一张精致卡片、模型生成一段 JSON 下发渲染、页面根据用户输入重新组织布局或调整主题，在今天都可能被放进同一个词：Generative User Interface, aka GenUI。

实际上对于工程师来说，把范围收窄到技术层面更简单易懂：端侧 UI 如何根据意图、状态、工具、数据和反馈，动态生成、调整或组装界面。从这个角度看，GenUI 不仅仅覆盖大家日常用 Web 页面，或者各类 App，还要囊括在尝试实时生成的游戏等。

这本小册会沿着几个可以观察的早期实践展开：OpenUI/Thesys C1、Google A2UI、Vercel 的实践，以及表达层、运行时和 Agent 开发里的具体问题。所有内容只围绕阶段性的行业观察展开，我们更关心哪些差异已经能被看见，哪些问题值得继续测试。我们不会尝试全面覆盖，诸如 Coding Agent 生成产品原型（不直接进入生产环境）以及游戏（极具实验性）均不在我们的涉猎范围。

## 版权声明

1. *个人创作*的内容，均遵守**[署名-非商业性使用 4.0 国际 (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/deed.zh-Hans)**协议。
2. 文章结尾完整的*链接引用*均按照 `标题加作者` 的格式嵌入链接，少量的*内容引用*均在上下文中以简单的*Markdown 链接引用*的格式给出原文链接。
3. 任何形式的引用，都会尽量减少对原文的修改，保持原语意。
4. 引用内容的主要组成是 OpenUI、A2UI、Thesys C1、Vercel AI SDK 等相关的官方文档、Github Repo、Demo、技术文章和产品实验。

## 关于

手册持续迭代中 🚧...当前版本号↓

![GitHub tag](https://img.shields.io/github/tag/2BAB/genui-field-notes.svg)

手册内容为人工编写，LLM 仅辅助翻译、纠错与润色。鼓励大家把 AI 更多使用在前期的发现探索、 Demo 实验、技术讨论等，而非小册写作本身。想参与手册编辑，请访问 GenUI Field Notes 的 [Github Repo](https://github.com/2BAB/genui-field-notes)。其他相关问题，欢迎[联系我](https://2bab.me/about)。

## 贡献者名单

<a href="https://github.com/2BAB/genui-field-notes/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=2BAB/genui-field-notes" />
</a>
