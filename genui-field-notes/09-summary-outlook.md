# A Current Summary and Outlook for Chat-like GenUI

## This Chapter Only Summarizes Chat-like GenUI

Most of the approaches and demos in this minibook revolve around the same product shape: a user sends a message, the system returns a card, form, list, or report inside the conversation, and the user continues through buttons and follow-up actions. The conclusions in this chapter therefore cover chat-like GenUI.

This is a practical scope for early experiments. One response has a relatively limited number of components, state range, and lifetime. A product can prepare its catalog, component library, tools, and action policy in advance, then gradually expand the model's role.

## Three Approaches Visible Today

Vercel AI SDK UI lets the model select a tool. The tool result enters a unified UI message stream, and the frontend maps the typed tool part to a Semantic Component. It connects easily to an existing React chat interface and backend tools, while application code controls most of the UI structure.

OpenUI and C1 let the model generate a UI program directly. The model can compose richer structures from a component library, while the Web runtime handles parsing, state, actions, Query, and Mutation. This route is useful for observing how much UI freedom can fit inside one conversational response.

A2UI organizes catalogs, Surfaces, the Data Model, components, and actions into a cross-platform protocol, then connects the Agent and client through A2A, AG-UI, or another transport. It focuses on how different clients understand and continue updating the same UI, and how interactions return to the Agent.

## What the Current Evidence Supports

First, the component set remains a product boundary. A model can select components, arrange layouts, or generate tool input. The catalog, component library, and business tools still determine what the product can display and execute.

Second, generation and runtime behavior need separate tests. Valid DSL or JSON proves that a structure can be parsed. A real product must also test layout, data sources, state restoration, actions, authorization, and error states.

Third, data should retain a trusted source. Weather, orders, inventory, and prices are better supplied by tools and APIs, while the model chooses how to present them. This separation makes generation errors and business-data errors easier to investigate independently.

Fourth, a UI becomes genuinely useful in a conversation when it can enter the next Run naturally. Message or Surface identity, action payloads, Thread history, approval, and logs are all part of that chat experience.

Fifth, GenUI expands the product's trust boundary. External content may carry prompt injection, client action payloads can be forged, and catalog or component sources can be poisoned. Generated output and interaction input should both be treated as untrusted data. Catalog governance, server-side authorization, and business validation remain product responsibilities. The experiments in this minibook do not yet cover these risks.

## Moving Beyond the Chat Box

Chat-like GenUI already connects the expression layer, runtime, and Agent Run. Moving toward general GenUI introduces longer-lived state, navigation, coordination across pages or Surfaces, client versions, permissions, and more complete testing and rollback. Experiments such as Google's dynamic view show a freer direction, with many engineering questions still open for validation.

## References

- [OpenUI](https://www.openui.com/docs/openui-lang)
- [A2UI](https://a2ui.org/)
- [AG-UI](https://docs.ag-ui.com/)
- [Vercel AI SDK: Generative User Interfaces](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces)
