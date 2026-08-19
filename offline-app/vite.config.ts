import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  base: './', // 👈 Relative paths are mandatory for native WebView and file:// protocols
  server: {
    port: 5174
  }
});
