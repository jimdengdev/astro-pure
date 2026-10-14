---
title: 'Syncing Upstream Theme Updates After a Repo Copy'
comment: true
link: sync-upstream-theme
publishDate: '2026-09-05T18:30:00'
updatedDate: '2026-09-05T18:30:00'
draft: false
language: 'English'
description: 'Your GitHub blog repo was copied without shared git history. This post covers adding upstream, classifying 185 merge conflicts, and fixing build errors.'
tags:
  - Git
  - GitHub
  - Astro
  - Blogging
  - Life
---

## The Problem: No Common Ancestor with Upstream

My blog is built on the [astro-koharu](https://github.com/cosZone/astro-koharu) theme. When I started, I downloaded the code and ran `git init` instead of forking on GitHub — which means my repository's root commit is a squashed "Initial commit" with **no shared history with upstream**.

Half a year later, the theme evolved from 4.1.0 to 6.3.0 and I wanted the new features. A plain `git pull upstream main` simply refuses:

```plain
fatal: refusing to merge unrelated histories
```

Worse, I had added custom features along the way — photo gallery, diary, GA4 analytics — many of which touched theme source code directly. This wasn't a simple pull; it was a merge that needed careful mine-clearing.

## Choosing Among Three Approaches

| Approach                                   | How it works                                                    | Best for                                |
| ------------------------------------------ | --------------------------------------------------------------- | --------------------------------------- |
| `koharu update`                            | Theme's built-in CLI: auto backup + conflict classification     | When the theme ships an update tool     |
| Manual `merge --allow-unrelated-histories` | Bypasses the common-ancestor restriction directly               | When you want full control of the merge |
| `koharu update --clean`                    | Overwrites everything with upstream, then restores user content | Too many conflicts, want a fresh start  |

I picked the first as the entry point and handled conflicts manually, because I knew exactly where my changes lived — a blanket overwrite would have wiped out 200+ lines of custom styles.

## The Core: Classify Conflicts Before Touching Anything

Once the merge started, 185 files landed in a conflicted state. Reviewing them one by one is a nightmare. The right move is **classify first, then batch-process**.

### Category 1: Upstream evolved, I never touched (158 files)

Upstream iterated on these and I never modified them. Take theirs blindly:

```bash
git checkout --theirs -- <file>
git add <file>
```

### Category 2: Infrastructure (5 files)

`package.json`, `pnpm-lock.yaml`, `astro.config.mjs` — upstream's changes were more substantial. Take theirs and run `pnpm install` afterwards.

### Category 3: Both sides modified (22 files) — the real decisions

Here's the trick that saved me: **compare blob SHAs instead of eyeballing diffs**.

```bash
# Fetch upstream blob SHAs via the GitHub API
gh api 'repos/OWNER/REPO/git/trees/main?recursive=1' \
  --jq '.tree[] | select(.type=="blob") | .path + " " + .sha' > upstream-blobs.txt

# Fetch my initial commit's blob SHAs
git ls-tree -r <initial-commit> | awk '{print $4 " " $3}' > initial-blobs.txt

# I modified + upstream also modified = true conflict
# I modified + upstream untouched = auto-safe
```

For the 22 true conflicts, my decision rules were simple:

| Criterion                                                         | Action                            |
| ----------------------------------------------------------------- | --------------------------------- |
| Core customizations (gallery, diary, brand colors, routes)        | `git checkout --ours` — keep mine |
| Upstream changes unrelated to my features, upstream more polished | Take theirs                       |
| i18n translation files where both sides added keys                | Script a key-level merge          |

The i18n merge deserves a mention. My `en.ts`/`zh.ts` had gallery-related keys; upstream added 90+ new keys; neither side could lose. I wrote a small Node script: my version is the baseline, upstream-only keys get appended, and on same-key collisions my values win. Three lines of core logic — far more reliable than copy-pasting by hand.

## Pitfalls: A Finished Merge Isn't a Finished Job

### Pitfall 1: The migration check blocked the build

Upstream added `koharu migrate --check`, which scans content before every build. It reported 14 "duplicate links in the same language" — example posts under `ja/ko` directories were treated as Chinese, because my `site.yaml` never enabled those locales.

These were upstream's example translations that I never used. Deleting the `en/ja/ko` example directories and fixing two real posts where the `link` field was copy-pasted unchanged got the check passing.

### Pitfall 2: Keeping "my version" can break upstream's dependency chains

The build failed with `Cannot read properties of undefined (reading 'enabled')`, traced to `live.config.ts` referencing `momentsConfig` — a new export in upstream's `site-config.ts` that my preserved old version didn't have.

The root issue: **when you resolve a conflict with "keep mine," you may silently cut an internal dependency that upstream code now relies on**. Since I don't use the Moments feature, I emptied the live collection:

```ts
export const collections = {} as unknown as ReturnType<typeof defineLiveCollection>
```

### Pitfall 3: My own component depended on a missing package

`@vercel/analytics/astro` failed to resolve — Vercel Analytics was a component I had added myself, but the merged `package.json` came from upstream, where it doesn't exist. I removed the component entirely (GA4 already covers my analytics needs) and cleaned up the config.

A principle worth keeping: **a merge is a good moment to prune dependencies, not blindly reinstall everything that's missing**.

## Long-Term Strategy

1. **Confine customizations to `config/` and `src/content/blog/`.** These areas are treated as user content and protected by every update tool.
2. **When you must touch theme source code, manage changes as `.patch` files** instead of editing in place. Re-applying patches after a merge keeps conflicts visible.
3. **Always back up before updating** — `pnpm koharu backup`, or at least a git tag.
4. **Inventory your own changes with `git diff --stat` before merging.** Knowing what you changed tells you what to protect.

Final result: 331 files changed, `+27,695 / −9,173` lines, theme 4.1.0 → 6.3.0, all custom features intact. The workflow is proven now — the next major upgrade will be much smoother.
