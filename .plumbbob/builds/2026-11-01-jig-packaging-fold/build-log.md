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

**Current step:** 2 — docs(jig): state what jig admits and how to migrate
**Heavy check:** checkride (set a "check" key in .plumbbob/settings.json to override)

## Steps

*(Mirror of intent.md's Steps, with live status; CLI-maintained, not hand-edited.
`build`/`checkpoint`/`revert` re-render this from intent.md, and set the Current step
line above. Only ONE step is in flight; a step is done only after a checkpoint:
check green + checkpoint taken, via `/plumbbob:verify` or `/plumbbob:build`.)*

- ☑ 1. chore(jig): fold version and commit-with-til into one plugin
- ☐ 2. docs(jig): state what jig admits and how to migrate
- ☐ 3. test(jig): enforce the admission rule with a node test

## Park list

> Mid-step, every new problem / idea / "ooh what if" lands HERE, untouched, and you
> go straight back to the step. Acting the instant an idea arrives is the disease.
> Capture is one line (`/plumbbob:park` composes it). Harvest happens only at the boundary.

- [ ] jig ships no plugin icon: claude plugin validate warns ICON_MISSING for the plugin directory listing (a square PNG at .claude-plugin/icon.png would clear it)
- [ ] jig README states the admission rule but does not point at the admission test that enforces it: step 3 lands after step 2 and its seam is the test file alone, so a one-line pointer would need a later docs edit
- [ ] three bare /version strings survive under plugins/jig/ in files C1 (no-engine-change) and D3 (pure-renames) freeze: bump.mjs line 3 (header comment) and line 177 (the config error tells the user to run /version init), and the template's line 1 comment; the C9 grep over docs is clean, so this waits for the v2 engine build

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

- (none yet)

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
