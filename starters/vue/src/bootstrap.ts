import { setupStore } from '@/stores';
import { setupRouter } from '@/router';
import { setupI18n } from '@/i18n';

export const bootstrap = async (app) => {
  setupStore(app);
  await setupRouter(app);
  setupI18n(app);
};
