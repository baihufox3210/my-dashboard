# Baihu Personal Website

## Development

Set `ADMIN_USERNAME` and a unique `ADMIN_PASSWORD` (at least 8 characters) in `.env` before starting the API. The server refuses to start if either is missing or the password is too short. The development command starts both the Vite frontend and the Express API:

```bash
npm run dev
```

The public blog is available at `#blog`. The private publishing area is intentionally not shown in the main navigation and is available at `#admin`.

## Run the API server at boot

On the deployed system, install the systemd override after installing dependencies and creating `.env`:

```bash
sudo mkdir -p /etc/systemd/system/baihu-blog-api.service.d
sudo cp deploy/baihu-blog-api.override.conf /etc/systemd/system/baihu-blog-api.service.d/override.conf
sudo systemctl daemon-reload
sudo systemctl enable --now baihu-blog-api.service
```

The override binds the API to the Docker bridge gateway and trusts `X-Real-IP` only from the Nginx container. If the bridge gateway or Nginx container address changes, update `API_HOST` and `TRUSTED_PROXY_IP` in the override. Check the service with `sudo journalctl -u baihu-blog-api.service`.

Articles are stored by the API in `data/articles.json`, and uploaded images are stored in `public/uploads/`. The API creates the `data` directory and article file on first start.

Available API endpoints:

- `GET /api/articles` - public published articles
- `GET /api/stats` - public site statistics
- `POST /api/auth/login` - administrator login
- `POST /api/auth/logout` - administrator logout
- `GET /api/auth/me` - current session status
- `POST /api/articles` - authenticated multipart article publishing

Sessions expire after 24 hours and are stored in memory, so restarting the API signs administrators out. A multi-instance production deployment should use a shared persistent session store.

The API rate limits repeated failed logins, uses an HttpOnly SameSite session cookie, validates uploaded image signatures and limits upload size, and rejects oversized article fields. The Nginx config adds browser security headers for the frontend. Serve production traffic over HTTPS so the session cookie's `Secure` flag is enabled (`NODE_ENV=production`).

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

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

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

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
