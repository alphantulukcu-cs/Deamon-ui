import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const apiProxyTarget = env.VITE_SCAN_LINK_API_PROXY_TARGET || 'http://127.0.0.1:8095'
  const serverHost = env.VITE_DEV_HOST || '127.0.0.1'
  const serverPort = Number(env.VITE_DEV_PORT || '5173')
  const allowedHosts =
    env.VITE_ALLOWED_HOSTS === 'all'
      ? true
      : (env.VITE_ALLOWED_HOSTS
          ?.split(',')
          .map((host) => host.trim())
          .filter(Boolean) ?? ['localhost', '127.0.0.1'])

  return {
    plugins: [react()],
    server: {
      host: serverHost,
      port: serverPort,
      strictPort: true,
      allowedHosts,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: serverHost,
      port: serverPort,
      strictPort: true,
      allowedHosts,
    },
  }
})
