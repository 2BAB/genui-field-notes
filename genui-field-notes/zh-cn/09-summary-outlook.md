# Chat-like GenUI 的阶段性总结与展望

## 本章只总结 Chat-like GenUI

这本小册调查的方案和 demo，大多围绕同一种形态展开：用户发出一条消息，系统在对话里返回一张卡片、表单、列表或报表，用户再通过按钮和 follow-up action 继续。因此，本章的结论只覆盖 chat-like GenUI 的方案。

这个范围适合先做实验。一段 response 的组件数量、状态范围和生命周期相对有限，产品可以提前准备 catalog、component library、tools 和 action policy，再逐步增加模型参与的部分。

## 目前看到的三种做法

Vercel AI SDK UI 让模型选择 tool，tool result 进入统一的 UI message stream，前端再把 typed tool part 映射到 Semantic Component。它与现有 React chat 和后端 tools 很容易接在一起，界面的结构主要由产品代码控制。

OpenUI / C1 让模型直接生成一段 UI program。模型可以在 component library 中组合更丰富的结构，Web runtime 继续处理 parser、state、action、Query 和 Mutation。它适合观察一轮对话里，UI 的表达自由度可以走到哪里。

A2UI 把 catalog、Surface、Data Model、component 和 action 整理成跨平台协议，再通过 A2A、AG-UI 或其他 transport 连接 Agent 与客户端。它更关心一块 UI 怎样被不同客户端理解、持续更新，并把交互发回给 Agent。

## 目前能确认的几件事

第一，组件集合仍然是产品边界。模型可以选组件、排布局或生成 tool input，最终能显示什么、能执行什么，仍由 catalog、component library 和业务 tools 决定。

第二，生成和运行要分开测试。合法的 DSL 或 JSON 只证明结构能够解析；真实产品还要检查 layout、data source、state restoration、action、权限和错误状态。

第三，数据应保留可信来源。天气、订单、库存和价格适合由 tool / API 返回，模型负责选择表达方式。这样生成错误和业务数据错误才容易分开排查。

第四，一张 UI 能否自然进入下一次 Run，决定了它在对话里是否真的可用。message / Surface identity、action payload、Thread history、approval 和日志，都是这段 chat 体验的一部分。

第五，GenUI 扩大了产品的信任边界。外部内容可能携带 prompt injection，客户端 action payload 可以被伪造，catalog 或 component source 也可能被投毒。生成结果和交互输入都应按不可信数据处理，catalog 管理、服务端授权和业务校验仍由产品系统负责；这些风险尚未包含在本册实验中。

## 从聊天框继续往外走

Chat-like GenUI 已经把表达层、runtime 和 Agent Run 连接了起来。往 general GenUI 扩展时，问题会变成长期状态、导航、多页面或多 Surface 协作、客户端版本、权限，以及更完整的测试和回滚。Google dynamic view 这类实验展示了更自由的方向，目前仍有不少工程问题需要继续验证。


## 参考资料

- [OpenUI](https://www.openui.com/docs/openui-lang)
- [A2UI](https://a2ui.org/)
- [AG-UI](https://docs.ag-ui.com/)
- [Vercel AI SDK: Generative User Interfaces](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces)
