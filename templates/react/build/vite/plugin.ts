import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons';
import iconPreview from '../../src/plugins/vite-plugin-icon-preview';
import AutoImport from 'unplugin-auto-import/vite';
import { resolve } from 'node:path';
import type { PluginOption } from 'vite';

export const pluginConfig:PluginOption[] = [
  react(),
  tailwindcss(),
  AutoImport({
    imports: [
      'react',
      'react-router-dom',
      {
        react: ['Suspense'],
        'react-router-dom': [['BrowserRouter', 'Router'], 'useRoutes'],
      },
    ],
    dts: 'src/types/auto-imports.d.ts', // 指定类型声明文件生成路径
    dirs: ['src/hooks', 'src/utils'],
  }),
  iconPreview({
    entry: '/icons',
    iconDirs: resolve(process.cwd(), './src/assets/icons'),
  }), // 自定义图标预览插件
  createSvgIconsPlugin({
    // 要缓存的图标文件夹
    iconDirs: [resolve(__dirname, 'src/assets/icons')],
    symbolId: 'icon-[name]',
  }),
]
