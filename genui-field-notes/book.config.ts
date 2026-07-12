import { defineMinibook } from '@2bab/minibook-kit/config'

const englishSidebar = [
  {
    text: '1. Introduction',
    link: '/'
  },
  {
    text: '2. Chat-like GenUI and Other Forms',
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
    text: '5. The GenUI Feature in Vercel AI SDK',
    link: '/05-vercel-generative-ui'
  },
  {
    text: '6. Comparing Framework Outputs at UI Generation Time',
    link: '/06-ui-expression-layer'
  },
  {
    text: '7. Data and Behavior Flow After UI Generation',
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
    text: '1. 简介',
    link: '/zh-cn/'
  },
  {
    text: '2. Chat-like GenUI 与其他形态',
    link: '/zh-cn/02-chat-like-genui'
  },
  {
    text: '3. OpenUI 与 Thesys C1',
    link: '/zh-cn/03-openui-thesys-c1'
  },
  {
    text: '4. Google A2UI 及其生态',
    link: '/zh-cn/04-google-a2ui'
  },
  {
    text: '5. Vercel AI SDK 的 GenUI 功能',
    link: '/zh-cn/05-vercel-generative-ui'
  },
  {
    text: '6. UI 生成时，不同框架的输出细节比对',
    link: '/zh-cn/06-ui-expression-layer'
  },
  {
    text: '7. UI 生成后，不同框架的数据和行为如何继续流转',
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
  analytics: {
    googleTagId: 'G-PB9N2K8ERH'
  },
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
