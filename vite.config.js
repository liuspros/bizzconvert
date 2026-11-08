import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Two pages: the public site (/) and the admin dashboard (/admin/)
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin/index.html', import.meta.url))
      }
    }
  }
});
