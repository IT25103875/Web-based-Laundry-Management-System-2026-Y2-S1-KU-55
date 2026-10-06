import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Keep local frontend/backend versions paired when another checkout is running.
async function backendTarget() {
  if (process.env.VITE_API_URL) return new URL(process.env.VITE_API_URL).origin;
  for (const port of [8080, 8082]) {
    const target = `http://127.0.0.1:${port}`;
    try {
      const response = await fetch(`${target}/api/garments/services`, {
        signal: AbortSignal.timeout(1500),
      });
      if (!response.ok) continue;
      const services = await response.json();
      if (Array.isArray(services)) return target;
    } catch { /* The backend may not have been started yet. */ }
  }
  return 'http://127.0.0.1:8080';
}

export default defineConfig(async ({ command }) => {
  const target = command === 'serve' ? await backendTarget() : 'http://127.0.0.1:8080';
  if (command === 'serve') console.info(`[CleanCloud] API proxy: ${target}`);
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target, changeOrigin: true },
      },
    },
  };
});
