# `scaffold` — new repo and new package from the canonical layout

_Spec seed, 2026-07-24. Candidate 7 of 10 from [`../../plugin-roadmap-survey.md`](../../plugin-roadmap-survey.md)._

## Problem

Every new project pays a setup tax, and the tax is paid by hand each time.

Evidence that the convention exists but is not packaged:

- **`add-package`** exists in 4 repos (foundry, gantry, trailhead, ridgeline-mk2) with 4
  distinct hashes whose diffs are cosmetic: test placement wording (`src/__tests__/` vs
  colocated) and tsconfig base (`@repo/config/tsconfig/lib.json` vs root
  `tsconfig.base.json`).
- **`scaffold:package`** and **`scaffold:app`** scripts appear in 4 `package.json` files.
- **`ts-check-scaffold`** is an entire repo that *is* the canonical layout, with its own
  `scaffold-init` / `scaffold-check` / `scaffold-flatten` skills.
- **`.check/` in 18 repos**, `check` scripts in 23, `sgconfig.yml` in 25 — the target
  configuration is already highly consistent. That consistency arrived by copying, which is
  why it is drifting.

The community version of this pain:

> I stopped all feature development for **three days** and instead built out a sophisticated
> PR-based CI pipeline using Github Actions. I am kicking myself for not doing this MUCH
> sooner.

And the reason it never gets templated:

> Setting this up manually for every project takes some time, and **I haven't really
> bothered to make a template for it** because I'm just not happy enough with the flow yet.

That second quote is the actual obstacle, and it applies here too. A scaffold plugin is only
worth building once the layout has stopped moving.

## Why this one

Monorepo tooling is a thin category (10 of 2,542). More importantly, this is the plugin that
prevents the next generation of drift: every repo scaffolded from one source starts
identical, which shrinks the surface [`../drift/spec.md`](../drift/spec.md) has to police.

It also has a natural bootstrapping relationship with the rest of the catalog — a scaffolded
repo should arrive with `.claude/version.json`, checkride wired up (`checkride init` +
`checkride agent-setup`, including the `Stop` gate that is currently deployed nowhere), and
`sgconfig.yml` already correct, rather than needing several `init` runs.

## Shape

```
skills/scaffold/SKILL.md
bin/scaffold                    # the generator
templates/                      # the canonical layout, parameterized
templates/scaffold.example.jsonc
```

Two verbs, matching the two things that actually get created:

- **`scaffold repo <name>`** — a new project from the `ts-check-scaffold` layout: package
  manager, tsconfig, vitest, oxlint, ast-grep + `sgconfig.yml`, `check` script writing to
  `.check/`, `.claude/` configs for the other plugins in this catalog, optional GitHub
  Actions.
- **`scaffold package <name>`** — the `add-package` case: a new workspace package inside an
  existing monorepo, inheriting that repo's conventions rather than the global defaults.

The second is the more valuable one day to day, and the one with 4 drifted implementations
to generalize from.

### Config — `.claude/scaffold.json`

Per-repo, for the `package` verb (the `repo` verb reads user-level defaults):

- `test_placement` — `colocated` vs `src/__tests__/`
- `tsconfig_base` — `@repo/config/tsconfig/lib.json` vs `tsconfig.base.json` vs custom
- `scope` — npm scope for workspace packages
- `package_manager` — pnpm (14 repos) vs npm (~20)
- `include` — which of vitest / oxlint / ast-grep / stryker to wire up

That list *is* the observed variance across the 4 implementations. Nothing else differs.

## Primitives worth using

- **`${CLAUDE_PLUGIN_DATA}`** for cached template state, if templates are ever fetched
  rather than bundled.
- **`bin/` executable** — a generator is a CLI, not a skill. Bare command on the Bash PATH.
- Note the constraint: **plugin `settings.json` supports only `agent` and
  `subagentStatusLine`**. A scaffolded repo's `.claude/settings.json` must be written by the
  generator as a file, not declared by the plugin.

## Open questions

1. **Has the layout actually stabilized?** This is the gating question. `ts-check-scaffold`
   has 187-line skills and its own `scaffold-flatten`, which suggests it is still being
   worked out. Scaffolding a moving target manufactures drift instead of preventing it.
   Check its commit recency before committing to this.
2. Is this a plugin or just a repo template + `degit`? The honest answer may be that GitHub
   template repos already solve the `repo` verb, and only the `package` verb needs a plugin.
   That would be a smaller and better build.
3. Should scaffolding a repo also register it with [`../fleet/spec.md`](../fleet/spec.md)?
4. How does an existing repo *adopt* the layout retroactively? That is closer to `drift` +
   `check init` than to scaffolding, and probably out of scope.

## Non-goals for v1

Framework scaffolding (Next, Vite, Fastify app skeletons) — those have good generators
already. Migrating existing repos onto the layout. Anything non-TypeScript; the portfolio is
100% Node/TS and pretending otherwise adds config for no user.

## Prior art to mine

`ts-check-scaffold` (the whole repo — it is the specification), the 4 `add-package`
SKILL.md files whose diff *is* the config schema, and the `scaffold:package` / `scaffold:app`
scripts in the 4 repos that have them.
