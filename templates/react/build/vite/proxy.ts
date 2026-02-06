export const getProxy =(url:string) => {
  return {
    '/api': {
      target: url, // 服务器请求地址
      changeOrigin: true, // 是否允许跨域
      rewrite: (path: string) => path.replace(/^\/api/, ''), // 请求地址重写, 请求地址前缀 /api 替换为空
    },
  }
}
