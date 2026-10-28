import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// the repo root holds the serverless function (api/) and the Turso .env
const root = fileURLToPath(new URL('..', import.meta.url))

// Local dev only: answer /api/search with the real serverless function and the
// root .env's Turso credentials, so `npm run dev` searches the live data.
function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api/search', async (req, res) => {
        try {
          Object.assign(process.env, loadEnv('development', root, 'TURSO_'))
          const api = pathToFileURL(path.join(root, 'api', 'search.js')).href
          const { default: handler } = await import(/* @vite-ignore */ api)
          const query = Object.fromEntries(new URL(req.url ?? '/', 'http://localhost').searchParams)
          const reply = {
            status(code: number) {
              res.statusCode = code
              return this
            },
            setHeader(name: string, value: string) {
              res.setHeader(name, value)
              return this
            },
            json(body: unknown) {
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(body))
              return this
            },
          }
          await handler({ query }, reply)
        } catch (e) {
          res.statusCode = 500
          res.end(String(e))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), devApi()],
})
