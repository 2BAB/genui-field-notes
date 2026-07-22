# GenUI Field Notes

<p align="center">
  <a href="https://genui-field-notes.2bab.com/">
    <img src="./genui-field-notes/public/media/genui-field-notes-cover.png" alt="GenUI Field Notes cover" width="560">
  </a>
</p>

A compact minibook for observing GenUI cases, UI expression, runtime behavior, and agent development.

**Read online:** [English](https://genui-field-notes.2bab.com/) · [简体中文](https://genui-field-notes.2bab.com/zh-cn/) · [繁體中文（台灣）](https://genui-field-notes.2bab.com/zh-tw/)

## Local Development

This repo is a single-book consumer of [`@2bab/minibook-kit`](https://github.com/2BAB/minibook-kit). The kit is consumed from a GitHub release tag, not npm.

```sh
pnpm install
pnpm dev
pnpm build
pnpm preview
```

## Configuration

- `minibook-kit.config.ts`: owner, social links, theme colors, and deployment defaults.
- `genui-field-notes/book.config.ts`: title, description, locale, and sidebar.
- `.vitepress/config.ts` and `.vitepress/theme/index.ts`: thin wrappers that import the shared kit.

## Deployment

`.github/workflows/deploy.yml` calls the reusable GitHub Pages workflow from `2BAB/minibook-kit` at the same release tag used by `package.json`.
