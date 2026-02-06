import { fileURLToPath, URL } from 'node:url';

export const  resolveConfig = {
  alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url)),
  },
}
