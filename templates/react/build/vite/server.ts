import { getProxy } from "./proxy";
import type { ServerOptions } from 'vite'

export const getServerConfig = (VITE_BASE_URL_DEV: string):ServerOptions => ({
  // 服务器代理配置
  proxy: getProxy(VITE_BASE_URL_DEV),
  open: false, // 自动打开浏览器
  port: 4500, // 服务端口
});
