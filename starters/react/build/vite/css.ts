import type { CSSOptions } from "vite"

export const cssConfig:CSSOptions = {
  preprocessorOptions: {
    scss: {
      // additionalData 的内容会在每个 scss 文件的开头自动注入
    },
  },
  // 进行 PostCSS 配置
  postcss: {
    plugins: [],
  },
}
