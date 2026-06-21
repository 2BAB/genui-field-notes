import { defineMinibook } from '@2bab/minibook-kit/config'

const englishSidebar = [
  {
    text: '1. What Is GenUI',
    link: '/'
  },
  {
    text: '2. Why Chat-like GenUI Gets So Much Attention',
    link: '/02-chat-like-genui'
  },
  {
    text: '3. OpenUI and Thesys C1',
    link: '/03-openui-thesys-c1'
  },
  {
    text: '4. Google A2UI and Its Surrounding Work',
    link: '/04-google-a2ui'
  },
  {
    text: "5. Vercel's Generative UI Practice",
    link: '/05-vercel-generative-ui'
  },
  {
    text: '6. The UI Expression Layer',
    link: '/06-ui-expression-layer'
  },
  {
    text: '7. The UI Runtime',
    link: '/07-ui-runtime'
  },
  {
    text: '8. GenUI in Agent Development',
    link: '/08-agent-development'
  },
  {
    text: '9. A Stage Summary and Outlook',
    link: '/09-summary-outlook'
  }
]

const chineseSidebar = [
  {
    text: '1. 什么是 GenUI',
    link: '/zh-cn/'
  },
  {
    text: '2. 为什么 GenUI 现在很多在讨论 chat-like GenUI',
    link: '/zh-cn/02-chat-like-genui'
  },
  {
    text: '3. OpenUI 与 Thesys C1',
    link: '/zh-cn/03-openui-thesys-c1'
  },
  {
    text: '4. Google A2UI 及其上下游',
    link: '/zh-cn/04-google-a2ui'
  },
  {
    text: '5. Vercel 的生成式 UI 实践',
    link: '/zh-cn/05-vercel-generative-ui'
  },
  {
    text: '6. UI 表达层',
    link: '/zh-cn/06-ui-expression-layer'
  },
  {
    text: '7. UI 运行时',
    link: '/zh-cn/07-ui-runtime'
  },
  {
    text: '8. Agent 开发里的 GenUI',
    link: '/zh-cn/08-agent-development'
  },
  {
    text: '9. GenUI 的阶段性总结与展望',
    link: '/zh-cn/09-summary-outlook'
  }
]

export default defineMinibook({
  id: 'genui-field-notes',
  srcDir: 'genui-field-notes',
  title: 'GenUI Field Notes',
  description: 'Field notes on GenUI cases, UI expression, runtime behavior, and agent development.',
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      sidebar: englishSidebar
    },
    'zh-cn': {
      label: '简体中文',
      lang: 'zh-CN',
      title: 'GenUI 的田野调查笔记',
      description: '关于 GenUI 案例、表达层、运行时与 Agent 开发的阶段性观察。',
      link: '/zh-cn/',
      sidebar: chineseSidebar
    }
  }
})
