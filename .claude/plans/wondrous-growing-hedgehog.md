# Show diff background colors for mixed add/remove hunks

## Context

Currently, diff line backgrounds for additions and deletions are disabled
(`getLineBackgroundColor` returns `undefined` for all types in
`SimpleDiff.tsx`). This is nice for pure-add or pure-remove diffs (e.g. new
files) since it avoids visual noise. But when a diff has a mix of additions and
deletions, it's hard to distinguish which lines were added vs removed — the only
signal is the left border color.

The fix: detect whether `filteredLines` contains both additions and deletions.
If so, apply the theme-aware diff background colors (which already exist via
`getDiffColors` in `codeThemes.ts`).

## Changes

### `src/app/pull-requests/diffs/SimpleDiff.tsx`

**In the `SimpleDiff` component:**

- Import `getDiffColors` from `@/app/lib/codeThemes`
- Compute `hasMixedChanges` from `filteredLines` (has both `add` and `remove`
  lines)
- Compute `diffColors` using the existing `getDiffColors()` helper
- Pass `diffColors` and `hasMixedChanges` (as `showDiffBackground`) to
  `DiffLine`

**In the `DiffLine` component:**

- Accept `diffColors` (`ThemeDiffColors`) and `showDiffBackground` (`boolean`)
  props
- Remove the `getLineBackgroundColor` function
- Compute `lineBackground` inline: when `showDiffBackground` is true, use
  `diffColors.diffAdd` for adds and `diffColors.diffRemove` for removes;
  otherwise `undefined`

## Verification

- `yarn lint`
- Visually confirm: a file with only additions shows no line backgrounds; a file
  with mixed additions/deletions shows colored backgrounds
