import { defineMinibookKit } from '@2bab/minibook-kit/config'

export default defineMinibookKit({
  owner: {
    name: '2BAB',
    author: '2BAB',
    homepage: 'https://2bab.com/',
    links: [
      {
        text: '2BAB',
        link: 'https://2bab.com/',
        icon: 'person'
      },
      {
        text: 'GitHub',
        link: 'https://github.com/2BAB/',
        icon: 'github'
      },
      {
        text: 'X',
        link: 'https://twitter.com/xx2bab/',
        icon: 'x'
      },
      {
        text: 'LinkedIn',
        link: 'https://linkedin.com/in/2bab/',
        icon: 'linkedin'
      }
    ]
  },
  repository: 'https://github.com/2BAB/genui-field-notes/',
  theme: {
    accentColor: '#0f766e',
    darkAccentColor: '#2dd4bf'
  },
  deployment: {
    productionBranch: 'main',
    domainSuffix: '2bab.com'
  }
})
