# GenUI in Agent Development: How UI Enters a Run

Following the previous two chapters one level deeper leads to the Agent runtime: how does a piece of UI become part of an Agent execution, and how does the system continue with the existing context after the user clicks a button?

This chapter follows one complete Run. OpenUI and A2UI remain the main comparison, with Vercel AI SDK as a lighter implementation reference.

## From Thread to Run

In a chat-like product, a Thread is a persistent conversation. A Run is one Agent execution with a beginning, a process, and an end. A user message can start a Run; a button, form submission, or approval inside generated UI can start the next one.

AG-UI defines this boundary directly. `RunAgentInput` contains `threadId`, `runId`, `state`, `messages`, `tools`, `context`, and `forwardedProps`. The event stream begins with `RUN_STARTED` and ends with `RUN_FINISHED` or `RUN_ERROR`, with text, tool-call, state, and activity events in between.

Compressed into one line, the flow looks like this:

```text
Thread
  -> Run #1: user message -> model / tools -> generated UI -> finish
  -> user interacts with the UI
  -> Run #2: action + thread context -> model / tools -> UI update -> finish
```

A Run and its transport are separate concerns. AG-UI can use SSE, WebSocket, or another transport. A2UI messages can live inside an A2A `DataPart` or be placed into an event stream by AG-UI middleware. The Flutter weather experiment uses A2A plus A2UI. The `ACTIVITY_SNAPSHOT` and recovery loop discussed later in this chapter come from the upstream AG-UI and CopilotKit implementations.

## What Starts a Run?

At the beginning of a Run, the model needs two kinds of input: task context and the UI capabilities available on the current client. Each approach organizes these inputs differently.

OpenUI's `ChatProvider` manages the thread, messages, and streaming state. After `processMessage()` is called, it sends the `threadId` and current messages to the backend. A stream adapter then converts AG-UI, OpenAI Responses, or custom backend output into a common message format. When the server calls the model, it also adds the OpenUI Lang contract generated from the component library and the tools available for this Run.

A2UI focuses on the UI payload, while A2A, AG-UI, or another runtime organizes the Agent Run input. On the A2A route, the Flutter client places `supportedCatalogIds` in request metadata, and the server returns A2UI messages the client can render. On the AG-UI and CopilotKit route, catalog capabilities, component schemas, and generation guidelines enter `RunAgentInput.context`; middleware can also inject a `render_a2ui` tool. The Agent receives both conversation context and the client's UI boundary.

Vercel AI SDK follows a shorter route. The browser first creates a `UIMessage`. `createAgentUIStream` validates the message history and converts it into the `ModelMessage` form used by the model. Tool definitions enter the Run with the model request. The model selects a tool, and the application maps the resulting typed tool part to a React component.

This input determines what the model does. OpenUI gives it language rules and component signatures. A2UI gives it a catalog and schema. A common Vercel implementation gives it a set of tools. The degree of UI freedom is already bounded before the Run starts.

## How UI Returns Within a Run

OpenUI places generated output in the assistant message content. The model streams OpenUI Lang, the frontend adapter accumulates the text, the streaming parser updates the AST whenever a statement closes, and the React renderer maps component calls to registered application components. `ChatProvider` keeps updating the current assistant message under the same message ID, allowing an incomplete UI to appear before the Run ends.

A2UI messages form another payload layer. On the A2A route, `createSurface`, `updateDataModel`, and `updateComponents` messages are placed in `application/a2ui+json` DataParts and handed to `SurfaceController` in order. With AG-UI middleware, an A2UI Surface becomes an `ACTIVITY_SNAPSHOT`: one stable `messageId` first carries `building` or `retrying`, then is replaced by the final `a2ui_operations` after validation. Loading, repair, and the final Surface occupy the same activity position in the Agent Run.

Vercel AI SDK converts text, reasoning, tool input, tool output, and custom data into `UIMessageChunk` values. `useChat` incrementally merges those chunks, and React selects a predefined component from a typed part such as `tool-weather`. This connects the Agent stream to frontend state. The UI structure inside the card still comes from application code.

All three routes share one requirement: generated UI must become a recognizable Run output, and the frontend needs a stable message or activity identity so it can merge streaming updates into the correct position.

## How a User Action Enters the Next Run

Local UI toggles can remain in the runtime, and business APIs can execute directly. This section focuses on the third category: the user wants the Agent to interpret another intent, call a tool, or reorganize the UI.

OpenUI's `@ToAssistant(...)` triggers `ContinueConversation`. The event contains a `humanFriendlyMessage` and may also carry `formState` and `formName`. The host receives it, calls `processMessage()`, and sends it as a new message in the same Thread. That starts the next Run. The weather experiment's "Show Tokyo weather" action follows this route.

An A2UI action carries a `surfaceId`, `sourceComponentId`, action name, and context. A2UI defines the client event, while the host chooses how to execute it. The Flutter experiment sends `select_city` back to the Python server as an A2A data part. CopilotKit's React bridge places the action in `forwardedProps.a2uiAction` and calls `runAgent()`. AG-UI's A2UI middleware organizes the action into synthetic assistant and tool messages so the Agent can see the UI interaction in its history.

```text
Run #1 output
  -> OpenUI message / A2UI Surface
  -> user action
  -> action payload + Thread context
  -> Run #2 input
```

This relationship depends on preserving UI identity. OpenUI needs to know which assistant message and form state produced the action. A2UI locates it through Surface and component IDs. The Agent runtime uses `threadId`, `runId`, tool-call ID, or action ID to connect the two Runs. Without these identifiers, a log only says "a button was clicked" and "the model ran again," with no way to explain the transition between them.

## Confirmation, Approval, and Pausing a Run

High-risk actions commonly split execution into two Runs. In the first Run, the Agent proposes sending an email or submitting an order, and the frontend displays confirmation or approval UI. The second Run executes the tool after the user confirms.

AG-UI's interrupt lifecycle provides a complete expression for this flow. Run #1 ends with `RUN_FINISHED`, with `outcome.type` set to `interrupt`. The outcome contains an `interruptId`, prompt text, and optional `toolCallId` and `responseSchema`. After the user makes a choice, the client starts Run #2 in the same Thread and places the result in `RunAgentInput.resume[]`. When state must be restored, the Agent should send `STATE_SNAPSHOT` and `MESSAGES_SNAPSHOT` before the first Run ends.

A2UI can render the confirmation card and collect structured input, while the surrounding Agent protocol supplies interrupt and resume semantics. OpenUI can generate a confirmation form and let the host pass its result into an Agent runtime. Vercel AI SDK provides tool-execution approval. The current weather experiments cover ordinary tool flows; approval remains a later validation target.

With this split, the UI presents the decision and collects input, while the Agent runtime pauses, correlates, resumes, and audits execution. The Run state also shows whether a click has already executed the real business action.

## Where Failures Occur

Once GenUI enters an Agent Run, failures fall into roughly three layers.

The first layer is the generation contract. The OpenUI parser can report syntax, component, and argument errors. A2UI generation needs to validate message schemas, the catalog, component references, and data. The upstream AG-UI A2UI toolkit implements a validate-and-retry path. It tries up to three times by default, appends structured errors from the previous attempt to the prompt, and only sends operations that pass validation to the renderer. This behavior comes from upstream source and tests. The Flutter weather experiment uses its own validator; connecting it to this recovery loop remains a later validation step.

The second layer is the Run and transport. `RUN_ERROR`, timeouts, cancellation, broken SSE streams, and duplicate actions all need to be associated with a specific `runId`. Approval flows must also verify that a resume belongs to the same Thread, that the `interruptId` is valid, and that duplicate submissions are idempotent.

The third layer is final rendering and business execution. The first A2UI weather generation produced 70 components that passed protocol validation, while Flutter still reported a 65-pixel overflow. An OpenUI Query or Mutation may encounter network, permission, or business errors at runtime. The schema checks structure; screenshots, layout logs, tool results, and business state check the actual outcome.

## What a Run Should Leave Behind

To make the complete path observable and debuggable, a GenUI Run should retain at least:

1. `threadId`, `runId`, trigger source, and the correlation ID of the previous Run or action.
2. Messages, state, tools, catalog/schema, and client capabilities sent to the Agent.
3. Model output, tool calls and results, the raw UI payload, and parser or validator results.
4. Stream events sent to the client, message/activity IDs, and the final Surface version.
5. Renderer errors, screenshots, user action payloads, and the entry point of the next Run.

The Vercel weather experiment records the browser, API, model, tool, UI stream, and raw SSE separately. The A2UI weather experiment retains the A2A request, A2UI messages, Flutter logs, and screenshots from both Runs. These records are more useful than the final image alone. As the previous two chapters showed, the UI is the output of the current Run, a recoverable part of the Thread, and the entry point for the next Run.

## References

- [Core architecture @ AG-UI](https://docs.ag-ui.com/concepts/architecture)
- [Events @ AG-UI](https://docs.ag-ui.com/concepts/events)
- [Interrupts @ AG-UI](https://docs.ag-ui.com/concepts/interrupts)
- [A2UI Transports @ A2UI](https://a2ui.org/concepts/transports/)
- [OpenUI React Headless @ GitHub](https://github.com/thesysdev/openui/tree/main/packages/react-headless)
- [Generative User Interfaces @ Vercel AI SDK](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces)
