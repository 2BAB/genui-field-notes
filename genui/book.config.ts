import { defineMinibook } from '@2bab/minibook-kit/config'

const englishSidebar = [
  {
    text: 'Introduction',
    link: '/'
  },
  {
    text: 'Routes',
    items: [
      { text: 'Technology Routes', link: '/routes/technology-routes' }
    ]
  },
  {
    text: 'Evaluation',
    items: [
      { text: 'Test Plan', link: '/evaluation/test-plan' }
    ]
  },
  {
    text: 'Scenarios',
    items: [
      { text: 'Chat-like vs General UI', link: '/scenarios/chat-like-vs-general' }
    ]
  }
]

const chineseSidebar = [
  {
    text: '简介',
    link: '/zh-cn/'
  },
  {
    text: '技术路线',
    items: [
      { text: '技术路线', link: '/zh-cn/routes/technology-routes' }
    ]
  },
  {
    text: '测试',
    items: [
      { text: '测试计划', link: '/zh-cn/evaluation/test-plan' }
    ]
  },
  {
    text: '场景',
    items: [
      { text: 'Chat-like 与 General UI', link: '/zh-cn/scenarios/chat-like-vs-general' }
    ]
  }
]

export default defineMinibook({
  id: 'genui',
  title: 'GenUI Field Notes',
  description: 'Field notes for comparing generative UI technical routes and scenario requirements.',
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
      description: '关于 GenUI 技术路线、测试方法与界面场景要求的阶段性观察。',
      link: '/zh-cn/',
      sidebar: chineseSidebar
    }
  }
})
