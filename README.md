# CS2 Teams — Server Control setup

This project includes a simple admin UI (`Server` tab) and a serverless proxy at `api/dathost/proxy` to send control actions (change map, pause, restart) to your Dathost control endpoint.

Quick steps to get running

1) Create a local env file

- Create `.env.local` in the repository root (DO NOT commit this file).
- Use the variables shown in `.env.example`. Example contents:

```
DATHOST_CONTROL_URL=https://api.example.com/matches/{matchId}/{action}
DATHOST_API_KEY=YOUR_DATHOST_API_KEY
ADMIN_SECRET=A_SERVER_ONLY_SECRET
VITE_ADMIN_SECRET=A_SERVER_ONLY_SECRET   # only for local testing
```

Replace the values with your real Dathost control URL and API key. The `DATHOST_CONTROL_URL` can be a template containing `{matchId}` and/or `{action}` which the proxy will replace.

2) Run locally (recommended: use Vercel CLI so `api/*` endpoints work)

Install Vercel CLI if you don't have it:

```powershell
pnpm i -g vercel
vercel login
```

Start the local dev server (runs frontend + serverless functions):

```powershell
vercel dev
```

Open the shown URL (usually http://localhost:5173). Go to the `Server` tab, enter a `matchId`, choose a map and click the action buttons.

3) Test the proxy directly (optional)

```bash
curl -X POST http://localhost:5173/api/dathost/proxy \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{"action":"change_map","matchId":"<match-id>","payload":{"map":"de_dust2"}}'
```

4) Deploy to Vercel (production)

- Push your repo to a Git provider.
- In the Vercel dashboard, add these Environment Variables in your project settings:
  - `DATHOST_CONTROL_URL`
  - `DATHOST_API_KEY`
  - `ADMIN_SECRET` (do NOT set `VITE_ADMIN_SECRET` in production)
- Deploy and use the Server tab on the deployed site.

Security notes
- Never commit secrets to git. Keep `.env.local` in `.gitignore` (see `.gitignore`).
- `VITE_ADMIN_SECRET` is included in the client bundle; only use it for local testing. In production keep only `ADMIN_SECRET` server-side.
- Consider further protection for the admin UI (authentication, IP restriction) if you plan to share it.

If you want, I can:
- Remove the `VITE_ADMIN_SECRET` usage and implement a safer server-issued short-lived token flow, or
- Create a small README section that auto-fills the most recent `matchId` from `api/matches` in the UI.
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
