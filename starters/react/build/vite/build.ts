import type { BuildOptions } from 'vite'

export const buildConfig: BuildOptions = {
  assetsInlineLimit: 4 * 1024,
  polyfillModulePreload: true,

  // 使用 esbuild 压缩
  minify: 'esbuild',

  target: 'modules',
  chunkSizeWarningLimit: 1024,
  outDir: 'dist',
  assetsDir: 'assets',
  sourcemap: false,

  rollupOptions: {
    output: {
      entryFileNames: 'assets/[name].js',
      chunkFileNames: 'assets/[name].js',

      assetFileNames(asset) {
        const sources = asset.originalFileNames.length ? asset.originalFileNames : asset.names;

        const name = sources[0] ?? asset.name;

        if (/\.(mp4|webm|ogg|mp3|wav|flac|aac)$/i.test(name)) {
          return 'media/[hash:16][extname]';
        }

        if (/\.(png|jpe?g|gif|svg)$/i.test(name)) {
          return 'img/[hash:16][extname]';
        }

        if (/\.(woff2?|eot|ttf|otf)$/i.test(name)) {
          return 'fonts/[hash:16][extname]';
        }

        return 'assets/[hash:16][extname]';
      },
    },
  },
};
