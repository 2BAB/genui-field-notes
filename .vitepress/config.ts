import type { UserConfig } from 'vitepress'
import baseConfig from '@2bab/minibook-kit/vitepress-config'
import { defineConfig } from 'vitepress'

function toPublicMediaPath(src: string) {
  return src.replace(/^(\.\.\/|\.\/)+public\/media\//, '/media/')
}

export default defineConfig({
  ...(baseConfig as UserConfig),
  markdown: {
    ...(baseConfig as UserConfig).markdown,
    config(md) {
      ;(baseConfig as UserConfig).markdown?.config?.(md)

      const defaultImageRule =
        md.renderer.rules.image ??
        ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))

      md.renderer.rules.image = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        const src = token.attrGet('src')

        if (src) {
          token.attrSet('src', toPublicMediaPath(src))
        }

        return defaultImageRule(tokens, idx, options, env, self)
      }
    }
  }
})
