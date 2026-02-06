import { fileURLToPath, URL } from 'node:url';
import type { UserConfig, ConfigEnv } from 'vite';
import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import { pluginConfig, resolveConfig, cssConfig, getServerConfig, buildConfig } from './build/vite';

// 获取当前目录路径
const __dirname = fileURLToPath(new URL('.', import.meta.url));

// https://vite.dev/config/
export default ({ mode }: ConfigEnv): UserConfig => {
  const { VITE_BASE_URL } = loadEnv(mode, resolve(__dirname, './env'));
  return defineConfig({
    base: '/',
    plugins: pluginConfig,
    resolve: resolveConfig,
    css: cssConfig,
    envDir: resolve(__dirname, './env'),
    server: getServerConfig(VITE_BASE_URL),
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
    build: buildConfig,
  });
};
