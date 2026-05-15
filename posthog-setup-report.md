<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into Pull Panda. PostHog is now initialized in the Electron renderer process with session replay and error boundary support. Users are identified by their GitHub login on successful sign-in, and 10 events are tracked across the core product flows: authentication, PR review submission, pull request lifecycle actions, and appearance customization.

## Changes summary

- **`src/renderer.tsx`** — PostHog initialized with `posthog-js`, app wrapped in `PostHogProvider` and `PostHogErrorBoundary` for automatic error capture and session replay.
- **`src/app/lib/store/authContext.tsx`** — User identified (`posthog.identify`) with GitHub login and profile on successful OAuth; `user_signed_in` captured.
- **`src/app/routes/SignInPage.tsx`** — `sign_in_started` captured when user clicks "Sign in with GitHub".
- **`src/app/settings/account.tsx`** — `user_signed_out` captured and `posthog.reset()` called on sign-out.
- **`src/app/pull-requests/ReviewDrawer.tsx`** — `review_submitted` (with review type and pending comment count) and `review_cancelled` captured.
- **`src/app/pull-requests/PullRequestActionsMenu.tsx`** — `pull_request_closed`, `pull_request_reopened`, and `pull_request_draft_toggled` captured with repository context.
- **`src/app/settings/appearance.tsx`** — `theme_changed` and `appearance_mode_changed` captured when user updates appearance settings.
- **`.env`** — `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` and `VITE_PUBLIC_POSTHOG_HOST` set.

## Events instrumented

| Event | Description | File |
|---|---|---|
| `sign_in_started` | User clicks "Sign in with GitHub" to begin OAuth device flow | `src/app/routes/SignInPage.tsx` |
| `user_signed_in` | User successfully authenticates via GitHub OAuth | `src/app/lib/store/authContext.tsx` |
| `user_signed_out` | User clicks Sign out from Account settings | `src/app/settings/account.tsx` |
| `review_submitted` | User submits a PR review (approve, request changes, or comment) | `src/app/pull-requests/ReviewDrawer.tsx` |
| `review_cancelled` | User cancels a pending PR review | `src/app/pull-requests/ReviewDrawer.tsx` |
| `pull_request_closed` | User closes a pull request via the actions menu | `src/app/pull-requests/PullRequestActionsMenu.tsx` |
| `pull_request_reopened` | User reopens a closed pull request via the actions menu | `src/app/pull-requests/PullRequestActionsMenu.tsx` |
| `pull_request_draft_toggled` | User toggles draft status of a pull request | `src/app/pull-requests/PullRequestActionsMenu.tsx` |
| `theme_changed` | User changes the code/UI color theme | `src/app/settings/appearance.tsx` |
| `appearance_mode_changed` | User changes light/dark/system appearance mode | `src/app/settings/appearance.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](/dashboard/680407)
- [Sign-in conversion funnel](/insights/jCJaXkJi) — Tracks how many users who initiate sign-in successfully authenticate
- [Reviews submitted over time](/insights/wSUl7jXP) — Daily review submissions broken down by type (approve / request changes / comment)
- [PR actions over time](/insights/Cp0rCSXW) — PR close, reopen, and draft toggle actions over time
- [Daily active reviewers](/insights/NzUkunPt) — Unique users submitting reviews per day (engagement signal)
- [User churn — sign-outs over time](/insights/ASrcxjCK) — Sign-ins vs sign-outs trend for churn monitoring

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
