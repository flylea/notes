import { createPinia } from 'pinia';

export * from './modules/user';
export * from './modules/theme';

export const setupStore = (app) => {
  const pinia = createPinia();

  app.use(pinia);
};
