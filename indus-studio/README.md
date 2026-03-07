# IndusBase Studio

The browser-based dashboard for IndusBase - The 1,000x faster Firebase alternative.

## Overview

IndusBase Studio is a modern, high-performance web dashboard built with SvelteKit 5 and TypeScript. It provides a comprehensive interface for managing your IndusBase projects.

## Tech Stack

- **Framework**: SvelteKit 5 (Svelte 5 with runes)
- **Language**: TypeScript 5.4
- **Bundler**: Vite 5
- **Package Manager**: npm
- **UI Library**: Custom components with Tailwind CSS-inspired design system
- **Table Component**: TanStack Svelte Table
- **Toast Notifications**: Built-in Svelte 5-compatible toast system

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`.

For a fully wired local Studio experience, run the gateway and the platform services first. Studio expects the backend stack to expose:

- `http://localhost:8000` for the gateway
- project/org metadata endpoints under `/meta/*`
- auth endpoints under `/auth/*`
- live service-backed admin domains such as `/ai`, `/queue`, `/notify`, `/config`, `/billing`, `/security`, `/status`, and `/enterprise`

## Workspace Context

Indus Studio is scope-aware:

- active organization is persisted in `localStorage`
- active project is persisted in `localStorage`
- active environment defaults to `production`
- Studio attaches `Authorization`, `X-IndusBase-Organization-ID`, `X-IndusBase-Project-ID`, `X-IndusBase-Environment`, and project `apikey` headers when available

If you complete onboarding in a fresh browser session, Studio will automatically hand off into the newly created project context.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PUBLIC_INDUSBASE_URL` | URL of the IndusBase API gateway | `http://localhost:8000` |

## Playwright E2E

```bash
# Install browser binary once per machine
npm run test:e2e:install

# Run focused Studio smoke flows
npm run test:e2e:smoke

# Run Studio browser tests
npm run test:e2e
```

Recommended local verification order:

```bash
docker-compose up -d --build
make studio-demo-seed
make studio-live-check
make runtime-check
make studio-check
make studio-build
make studio-smoke
make studio-e2e
```

High-value demo routes to verify before recording screenshots or customer demos:

- `/dashboard`
- `/queue`
- `/notifications`
- `/flags`
- `/billing`
- `/enterprise/sso`
- `/security`
- `/audit`
- `/status`
- `/support`
- `/ai`

Environment overrides:

- `STUDIO_BASE_URL` defaults to `http://127.0.0.1:3000`
- `API_BASE_URL` defaults to `http://127.0.0.1:8000`
- `E2E_EMAIL` defaults to `admin@indusbase.local`
- `E2E_PASSWORD` defaults to `AdminPass123!`

## Troubleshooting

- If `docker-compose up -d --build` cannot run, install Docker first. The Studio verification path assumes Docker and a locally running compose stack.
- If Studio loads but shows no data, verify the API gateway is reachable at `PUBLIC_INDUSBASE_URL`.
- If the command palette or scope switcher looks empty, sign in first and ensure `/meta/organizations` and `/meta/projects` return data.
- If E2E tests skip, the suite could not reach both Studio and the API stack. Start the platform first, then rerun.
- If docs/public links are wrong for your environment, set `PUBLIC_DOCS_URL` explicitly.
- If onboarding creates a project but the dashboard looks empty, confirm `active_org_id` and `active_project_id` were written to `localStorage` and that the selected project belongs to the selected organization.
- If admin pages render read-only banners, verify the signed-in user has `admin` or `owner` role claims in the auth payload.

## Demo Preparation

- Seed at least one organization and one project before a live demo.
- Preferred local path:
  - `docker-compose up -d --build`
  - `make studio-demo-seed`
  - `make studio-live-check`
  - `make studio-screenshot-check`
- Verify dashboard, queue, notifications, billing, and status pages all load from a running stack.
- Verify enterprise SSO, security, audit, and AI pages as well if the audience is technical or enterprise-focused.
- Use the command palette (`Cmd/Ctrl+K`) to confirm navigation and quick actions are responsive.
- Keep `PUBLIC_INDUSBASE_URL` and public docs/status URLs aligned with the environment you are presenting.
- Run `make phase14-status` as a quick sanity marker that the live verification targets are present.

## License

MIT License - part of the IndusBase project.
