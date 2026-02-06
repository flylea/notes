/// <reference types="vite/client" />
import Vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import AutoImport from 'unplugin-auto-import/vite';
import { defineConfig, loadEnv } from 'vite';
import Components from 'unplugin-vue-components/vite';
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers';
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons';
import iconPreview from './src/plugins/vite-plugin-icon-preview';
import type { UserConfig } from 'vite';

// 获取当前目录路径
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const cssConfig = {};

// server 配置将放入 defineConfig 中，需先占位类型
const createServerConfig = (env: Record<string, string>) => {
  return {
    proxy: {
      [env.VITE_API_PREFIX]: {
        target: env.VITE_API_BASE_URL,
        changeOrigin: true,
        rewrite: (path: string) => path.replace(new RegExp(`^${env.VITE_API_PREFIX}`), ''),
      },
    },
    port: Number(env.VITE_SERVER_PORT) || 4456,
    open: env.VITE_AUTO_OPEN === 'true',
  } as const;
};

const createBuildConfig = (env: Record<string, string>) => {
  const isProd = env.NODE_ENV === 'production' || env.VITE_APP_MODE === 'production';
  return {
    assetsInlineLimit: 4 * 1024,
    modulePreload: { polyfill: true },
    minify: 'esbuild' as const,
    target: 'modules',
    chunkSizeWarningLimit: 1024,
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        assetFileNames({ name }: { name: any }) {
          const info = name.split('.');
          let ext = info[info.length - 1];
          if (/\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/i.test(name)) {
            ext = 'media';
          } else if (/\.(png|jpe?g|gif|svg)(\?.*)?$/.test(name)) {
            ext = 'img';
          } else if (/\.(woff2?|eot|ttf|otf)(\?.*)?$/i.test(name)) {
            ext = 'fonts';
          }
          return `${ext}/[hash:16][extname]`;
        },
      },
    },
    esbuild: isProd
      ? {
          drop: ['console', 'debugger'],
        }
      : undefined,
  } as const;
};

// https://vite.dev/config/
export default ({ mode }: { mode: string }): UserConfig => {
  // 加载环境变量
  const env = loadEnv(mode, resolve(__dirname, './env'), '');
  const enableIconPreview = env.VITE_ICON_PREVIEW === 'true';

  const pluginConfig = [
    Vue({
      template: {
        transformAssetUrls: {
          video: ['src', 'poster'],
          source: ['src'],
          img: ['src'],
          image: ['xlink:href', 'href'],
          use: ['xlink:href', 'href'],
        },
      },
    }),
    Components({
      resolvers: [
        AntDesignVueResolver({
          importStyle: false, // css in js
        }),
      ],
      dts: resolve(__dirname, './src/types/components.d.ts'),
    }),
    tailwindcss(),
    // 图标预览插件 - 仅在启用时加载
    ...(enableIconPreview
      ? [
          iconPreview({
            entry: '/icons',
            iconDirs: resolve(process.cwd(), './src/assets/icons'),
          }),
        ]
      : []),
    AutoImport({
      resolvers: [],
      imports: ['vue', 'vue-router'],
      dts: resolve(__dirname, './src/types/auto-imports.d.ts'),
    }),
    createSvgIconsPlugin({
      // 要缓存的图标文件夹
      iconDirs: [resolve(__dirname, 'src/assets/icons')],
      symbolId: 'icon-[name]',
    }),
  ];

  return defineConfig({
    // 生产环境打包路径
    base: '/',

    plugins: pluginConfig,

    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    envDir: resolve(__dirname, './env'),

    css: cssConfig,

    server: createServerConfig(env),

    build: createBuildConfig(env),
  });
};
