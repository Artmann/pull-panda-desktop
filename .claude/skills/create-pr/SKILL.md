---
name: create-pr
description:
  Creates a GitHub pull request. Checks out a feature branch if needed, runs
  tests, type checking, and linting (fixing all issues), formats code, commits
  changes, pushes, and opens a PR. Use when the user says "create a PR", "open a
  PR", "submit a PR", or "/pr".
allowed-tools: Bash(git:*) Bash(yarn:*) Bash(gh:*) Bash(npx:*)
---

# Create Pull Request

Follow these steps in order to create a pull request.

## 1. Branch check

Check the current branch with `git branch --show-current`.

- If on `main`, create and check out a new descriptive feature branch based on
  the staged/unstaged changes (e.g. `git checkout -b add-dark-mode-toggle`).
  Pick a short, descriptive name that reflects what the changes do.
- If already on a feature branch, stay on it.

## 2. Run tests

```bash
yarn test:run
```

Do NOT use `yarn test` — that starts watch mode.

If any tests fail, fix the failures and re-run until all tests pass. Fix ALL
failing tests, not just ones related to the current changes.

## 3. Type check

```bash
yarn typecheck
```

If there are type errors, fix them and re-run until clean. Fix ALL type errors
in the codebase, not just ones from the current changes.

## 4. Lint

```bash
yarn lint
```

If there are lint errors, fix them and re-run until clean. Fix ALL lint issues
in the codebase, not just ones related to the current changes.

## 5. Format

```bash
yarn format
```

This formats all files with Prettier. Always run this after making any fixes in
steps 2–4.

## 6. Commit

Stage and commit all changes. Use your judgment on whether to create one commit
or multiple logical commits. Write clear, concise commit messages.

- Do NOT include `Co-Authored-By` in commit messages.
- Use HEREDOC syntax for multi-line commit messages:

  ```bash
  git commit -m "$(cat <<'EOF'
  Short summary of changes

  Optional longer description.
  EOF
  )"
  ```

## 7. Push

```bash
git push -u origin <branch-name>
```

Replace `<branch-name>` with the current branch name.

## 8. Create PR

Use the GitHub CLI to create a pull request. Write the body following the "Pull
request descriptions" rules in `CLAUDE.md`: a plain-language `Summary`, a prose
`Technical details` section, a manual `Test plan` (no `yarn` commands — those
are gates from earlier steps, not review steps), and the optional
`Breaking changes` / `Out of scope` sections only when they apply. Omit optional
sections entirely when there's nothing to put under them — never emit a "None"
placeholder.

```bash
"/c/Program Files/GitHub CLI/gh.exe" pr create --title "<concise title>" --body "$(cat <<'EOF'
## Summary

<1–3 plain-language sentences describing what the PR does and why it matters.
Lead with the user-visible effect, not the implementation.>

## Technical details

<Prose paragraph(s) describing what changed, which components are affected,
and any notable implementation decisions. Reference paths and symbols
inline.>

## Test plan

- [ ] <Imperative manual step a reviewer runs in the app>
- [ ] <…>
EOF
)"
```

Keep the PR title short (under 70 characters).

When the PR genuinely has breaking changes / migration notes, append a
`## Breaking changes` section with bullets describing what a reviewer or
existing user must do. When there are related items deliberately left out of
this PR that a reviewer might ask about, append a `## Out of scope` section with
1–3 bullets.

If `gh pr create` fails because a PR already exists for this branch, find and
report the existing PR URL instead:

```bash
"/c/Program Files/GitHub CLI/gh.exe" pr view --web 2>/dev/null || "/c/Program Files/GitHub CLI/gh.exe" pr list --head "$(git branch --show-current)" --json url --jq '.[0].url'
```

## 9. Report

Always end by posting the PR URL to the user. This is the final output — never
skip it.
