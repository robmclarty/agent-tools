<!--
build-log.md: your live ledger for execution. Append constantly; reorganize at
step boundaries. The antidote to "my plan got lost in the noise."

  Steps     : where you are. One step in flight at a time. CLI-maintained: `build`,
              `checkpoint`, and `revert` keep this mirror and the Current step line
              in sync with intent.md; you never hand-edit them.
  Park list : where ideas go so you do not chase them. CAPTURE, never act inline.
  Harvest   : the boundary ritual that keeps you on one branch.
  Log       : the build's history. `plumbbob checkpoint` appends a line per step as it
              lands; feeds the /plumbbob:finish report, which rides the branch into the PR.
-->

# Build log: jig packaging fold

**Current step:** none (at the boundary)
**Heavy check:** checkride (set a "check" key in .plumbbob/settings.json to override)

## Steps

*(Mirror of intent.md's Steps, with live status; CLI-maintained, not hand-edited.
`build`/`checkpoint`/`revert` re-render this from intent.md, and set the Current step
line above. Only ONE step is in flight; a step is done only after a checkpoint:
check green + checkpoint taken, via `/plumbbob:verify` or `/plumbbob:build`.)*

- ☑ 1. chore(jig): fold version and commit-with-til into one plugin
- ☑ 2. docs(jig): state what jig admits and how to migrate
- ☑ 3. test(jig): enforce the admission rule with a node test

## Park list

> Mid-step, every new problem / idea / "ooh what if" lands HERE, untouched, and you
> go straight back to the step. Acting the instant an idea arrives is the disease.
> Capture is one line (`/plumbbob:park` composes it). Harvest happens only at the boundary.

- [x] jig ships no plugin icon: claude plugin validate warns ICON_MISSING for the plugin directory listing (a square PNG at .claude-plugin/icon.png would clear it)
- [x] jig README states the admission rule but does not point at the admission test that enforces it: step 3 lands after step 2 and its seam is the test file alone, so a one-line pointer would need a later docs edit
- [x] three bare /version strings survive under plugins/jig/ in files C1 (no-engine-change) and D3 (pure-renames) freeze: bump.mjs line 3 (header comment) and line 177 (the config error tells the user to run /version init), and the template's line 1 comment; the C9 grep over docs is clean, so this waits for the v2 engine build

## Harvest  *(run `/plumbbob:harvest` at each step boundary, after green)*

Classify each parked item as exactly ONE. Naming it before acting is what keeps you
from sprawling across branches.

| Class            | Meaning                                   | Action                               |
| ---------------- | ----------------------------------------- | ------------------------------------ |
| **blocker**      | Plan was wrong/incomplete; can't proceed  | `/plumbbob:revert`, fold into intent |
| **tangent**      | A different path, not clearly better      | Defer or kill. Default here.         |
| **pivot signal** | Evidence the whole approach is wrong      | Stop. Replan deliberately.           |

> Reality check: almost everything that *feels* like a pivot is a tangent. Require a
> failed assumption, not a shinier idea, before you pivot.

Harvest results this boundary:

- 2026-11-01, at range 1 of 1's stop: 3 parked ideas, classified.
- **tangent**: park 1 · jig ships no plugin icon: claude plugin validate warns ICON_MISSING for the plugin directory listing (a square PNG at .claude-plugin/icon.png would clear it) → a listing icon is a plugin-directory concern, not the fold's, and the validator's verdict is unchanged without it
- **tangent**: park 2 · jig README states the admission rule but does not point at the admission test that enforces it: step 3 lands after step 2 and its seam is the test file alone, so a one-line pointer would need a later docs edit → a one-line pointer from the README to the test is a docs nicety the next docs edit can carry
- **tangent**: park 3 · three bare /version strings survive under plugins/jig/ in files C1 (no-engine-change) and D3 (pure-renames) freeze: bump.mjs line 3 (header comment) and line 177 (the config error tells the user to run /version init), and the template's line 1 comment; the C9 grep over docs is clean, so this waits for the v2 engine build → the fix is an engine string change, which this build's C1 (no-engine-change) forbids and the separate v2 engine build already owns

## Log

*(The build's history, oldest first. `plumbbob checkpoint` appends an entry here
every time a step lands (via `/plumbbob:build` or `/plumbbob:verify`): the dated line,
and beneath it the pause as you approved it, so this fills in as you go, not at the
end, and an older step's detail is a scroll away. Add your own decision/event lines too: this is what
you point at to say "I did that: the LLM helped, but those were my calls."
`/plumbbob:finish` reads this for the report; `plumbbob finish` commits it with the build
folder, so it rides the branch into the PR.)*

- 2026-11-01 — plan committed · 3d5222f4d

  **Recommendation**: Approve it. Every open question is resolved and each resolution is a Decision the steps cite, so a builder has nothing left to guess through. The seams were read against the tree before the plan was written and nothing the refine changed touches them: the scripts and tests still move as pure renames, the SKILL.md edits (eight path segments, eight namespaced names, one reworded sentence) stay far above git's rename threshold, and the root README edit joins step 1's commit without widening its check. The one thing left for you before typing the run is the work-marketplace name check that D11 asks for.

  **1.** What the refine settled (Open questions Q1 to Q7, all resolved 2026-11-01)

  The cold read's two findings became Q4 and Q5 under `/plumbbob:refine` and are closed: the plugin README, the root README, and both SKILL.md files name `/jig:version` and `/jig:commit` only, with no bare-name note, since bare `/version` never resolved ([D14 (namespaced-names)](../../.plumbbob/builds/2026-11-01-jig-packaging-fold/intent.md#d14)); and the root README changes in step 1 with the marketplace, so no commit carries docs behind its manifest ([D15 (root-readme-in-step-1)](../../.plumbbob/builds/2026-11-01-jig-packaging-fold/intent.md#d15)). The refine also widened the ambient clause to agents and LSP servers, in the README and the test ([D13 (ambient-list)](../../.plumbbob/builds/2026-11-01-jig-packaging-fold/intent.md#d13)), pinned the test's scratch copies to `os.tmpdir()` and its frontmatter-only read ([D9 (rule-is-tested)](../../.plumbbob/builds/2026-11-01-jig-packaging-fold/intent.md#d9)), set the start version at 0.2.0 ([D12 (carry-version)](../../.plumbbob/builds/2026-11-01-jig-packaging-fold/intent.md#d12)), and gated step 1 on the work-marketplace name check ([D11 (name-check-first)](../../.plumbbob/builds/2026-11-01-jig-packaging-fold/intent.md#d11)). Step 2's title and seam shrank to the plugin README alone, and C9 makes the namespaced-only rule a constraint `/plumbbob:verify` can grep for.

- 2026-11-01 — step 1 checkpointed · 97fe3bd82 — chore(jig): fold version and commit-with-til into one plugin (4m)
- 2026-11-01 — step 2 checkpointed · aea8a0aa9 — docs(jig): state what jig admits and how to migrate (4m)
- 2026-11-01 — step 3 checkpointed · 3700ad96f — test(jig): enforce the admission rule with a node test (1m)
- 2026-11-01 — range 1 of 1's stop recorded — run the manual check under `claude --plugin-dir plugins/jig` (`/jig:version` with no args reaches the engine's usage output; `/jig:commit` runs its script with no permission prompt), then finish, push, and swap the installs

  **Summary**: The two plugins are one: `plugins/jig/` holds both skills, their scripts moved as 100% renames with history following, one manifest at 0.2.0, one marketplace entry, a README that opens with the four-clause admission rule and closes with the migration, and a fifteen-case test that proves the rule's two checkable clauses against scratch copies. The check ends `3 plugins validated, 10 test files`, both `claude plugin validate` calls pass, and the only bare `/version` left under `plugins/jig/` sits in three lines of the engine and template that C1 (no-engine-change) and D3 (pure-renames) keep byte-identical.

  1. Three bare `/version` strings survive in files this build may not edit
  2. Two plan statements each needed a read against a newer one
  3. Step 1's seam was rewritten before it would enter
  4. The fold is pure renames, history follows, and the counts moved as planned
  5. The admission test proves each failure instead of asserting it

  **Readout**:

  ```text
  steps        3 of 3 landed
               - 1 97fe3bd · 2 aea8a0a · 3 3700ad9
  check        green: 1 of 1 checks, 3 landings
  done-when    met
  decisions    honored
               - D1 (jig-bundle), D3 (pure-renames), D4 (segment-everywhere)
               - D5 (marketplace-with-move), D6 (one-description), D7 (readme-carry)
               - D8 (admission-rule), D9 (rule-is-tested), D10 (migration-one-sitting)
               - D12 (carry-version), D13 (ambient-list), D14 (namespaced-names)
               - D15 (root-readme-in-step-1)
  constraints  bent: C9 (namespaced-only), three engine strings C1 freezes
               → section 1; the C7 grep is clean and every document is namespaced
  seam         held: 3 of 3 steps, no strays
  diff         +2120 -1954 across 23 files
               - .claude-plugin/marketplace.json +9 -20
               - README.md +7 -9
               - plugins/commit-with-til/.claude-plugin/plugin.json +0 -21
               - plugins/commit-with-til/README.md +0 -84
               - plugins/commit-with-til/scripts/__tests__/commit.test.mjs +0 -172
               - plugins/commit-with-til/scripts/commit.sh +0 -228
               - plugins/commit-with-til/skills/commit/SKILL.md +0 -92
               - and 16 more
  spent        9 min · green first run at every landing
  ```

  **Verdict**: ○ Out of plumb (constraints bent)

  **Harvested**: **3** of 3 parked ideas open

  | Park | Why it matters | Lean |
  | --- | --- | --- |
  | **P1**: [Add a jig plugin icon](#park-list) | clears the only validator warning, and the first save is the one that sets the listing icon | tangent: a listing icon is a plugin-directory concern, not the fold's, and the validator's verdict is unchanged without it |
  | **P2**: [README points at admission test](#park-list) | tells the next contributor the rule is enforced, not only stated | tangent: a one-line pointer from the README to the test is a docs nicety the next docs edit can carry |
  | **P3**: [Engine still says bare /version](#park-list) | the config error tells a jig user to type a command that does not resolve | tangent: the fix is an engine string change, which this build's C1 (no-engine-change) forbids and the separate v2 engine build already owns |

  **Recommendation**: Run the manual check, then `/plumbbob:finish`, push, and swap the installs as the README's Migrating section says, taking all three parks as tangents. Every step landed Plumb and the range's one bent row is three strings the plan itself freezes, so nothing here needs a step before the push; the swap is yours because the old entries left the marketplace in step 1, and the README asks for it in one sitting. Start the check from the repo root:

  ```sh
  claude --plugin-dir plugins/jig
  ```

  In that session, `/jig:version` with no arguments should print the engine's usage error, and `/jig:commit` should run its script without a permission prompt. A prompt there means a path in `skills/commit/SKILL.md` missed its `commit/` segment, which the plan's range note says to fix on step 1's seam before finishing. P3 is the only park with a user-facing effect, and it waits for the v2 engine build where the string can change without breaking C1.

  **1.** Three bare `/version` strings survive in files this build may not edit

  The C9 (namespaced-only) grep is clean over every document: both SKILL.md files, the plugin README, and the root README name `/jig:version` and `/jig:commit` only. It still hits `scripts/version/bump.mjs` twice (the header comment, and the config error that tells the user to run `/version init`) and the first line of `templates/version.example.jsonc`. All three files land byte-identical by C1 (no-engine-change) and D3 (pure-renames), the plan's "not doing" list rules out any engine change, and none of the three is in a step's seam, so the lines stayed and the finding is parked as P3. Step 2's done-when asks for the same grep to return nothing; it does over documents, and these three lines are the whole gap. The one user-facing effect is the error message, which names a command that never resolved under the old plugin either.

  **2.** Two plan statements each needed a read against a newer one

  D6 (one-description) quotes the shared description with bare `/version` and `/commit`, and D14 (namespaced-names) renames the skills everywhere while C9 forbids a bare name under `plugins/jig/`; the manifest and marketplace carry D6's text with those two names namespaced and nothing else changed. D10 (migration-one-sitting) names the plugins to uninstall as `version@robmclarty` and `commit-with-til@robmclarty`, and C7 (grep-clean) forbids both tokens outside the changelog; the Migrating section names them by bare plugin name, which the CLI accepts, so the note says what D10 asks and the C7 grep is clean over the repo. Both reads are two tokens to flip if you want the older wording.

  **3.** Step 1's seam was rewritten before it would enter

  `plumbbob build 1` refused the seam as planned, since `plugins/version/**` is a glob and seams take exact paths or `dir/` grants. The line in `intent.md` was rewritten to the same five grants in that form (`plugins/version/`, `plugins/commit-with-til/`, `plugins/jig/`, the marketplace manifest, and the root README) and the step entered; no step, decision, done-when, or range changed.

  **4.** The fold is pure renames, history follows, and the counts moved as planned

  `git diff -M --stat 4e29ebb` shows `bump.mjs`, `commit.sh`, both test files, and the template at 100%, the two SKILL.md files at 95% and 79%, and the manifest at 56%; `git log --follow` reaches pre-move history for all four files C6 (history-follows) names. The manifest moved with `git mv` too, so its history follows although the sketch only called it new. The check went from `4 plugins validated, 9 test files` at the baseline to `3 plugins validated, 9 test files` after step 1 and `3 plugins validated, 10 test files` after step 3, with `scripts/check.sh` and `scripts/validate-marketplace.sh` untouched. The validator's one warning is ICON_MISSING, parked as P1, and its advice about a missing install line cleared when step 2's README landed.

  **5.** The admission test proves each failure instead of asserting it

  Two exported free functions run over a plugin root: one lists every `skills/*/SKILL.md` whose leading frontmatter block does not set `disable-model-invocation: true`, reading that block and nothing else, and one lists every ambient component from D13 (ambient-list)'s set, on disk or as a `plugin.json` key. Both return empty on the live tree. Thirteen more cases each copy the plugin under `os.tmpdir()`, inject exactly one violation, assert the function names it, and remove the copy in a `finally`, so a failing run leaves nothing inside `plugins/jig/` for `check.sh` to discover. The README states the rule but does not point at this test, since step 3's seam was the test alone; that is P2.
