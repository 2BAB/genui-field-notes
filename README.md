# GenUI Field Notes

A compact minibook for observing GenUI cases, UI expression, runtime behavior, and agent development.

Read it in [English](https://genui-field-notes.2bab.com/) or [简体中文](https://genui-field-notes.2bab.com/zh-cn/).

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
