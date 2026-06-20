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

export default defineMinibook({
  id: 'genui',
  title: 'GenUI Field Guide',
  description: 'A field guide for comparing generative UI technical routes and scenario requirements.',
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      sidebar: englishSidebar
    }
  }
})
