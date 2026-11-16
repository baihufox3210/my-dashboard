import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// Adds "Sitemap: <SITE_URL>/sitemap.xml" to the built robots.txt when SITE_URL is set (in
// the environment or .env), so crawlers find the sitemap without a domain in the repo.
function robotsSitemap(siteUrl: string | undefined): Plugin {
  let outDirectory = 'dist'
  return {
    name: 'robots-sitemap',
    apply: 'build',
    configResolved(config) { outDirectory = path.resolve(config.root, config.build.outDir) },
    closeBundle() {
      const file = path.join(outDirectory, 'robots.txt')
      if (!siteUrl || !fs.existsSync(file)) return
      const text = fs.readFileSync(file, 'utf8')
      if (/^Sitemap:/im.test(text)) return
      fs.writeFileSync(file, `${text.trimEnd()}\n\nSitemap: ${siteUrl.replace(/\/+$/, '')}/sitemap.xml\n`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), robotsSitemap(loadEnv(mode, process.cwd(), '').SITE_URL)],
  server: {
    fs: {
      deny: ['**/security-flags.json'],
    },
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', xfwd: true },
      '/uploads': { target: 'http://127.0.0.1:3001', xfwd: true },
    },
  },
}))
