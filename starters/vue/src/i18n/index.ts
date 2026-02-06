import { createI18n } from 'vue-i18n';
import cn from './locales/zh-cn';
import en from './locales/en-us';

// Define the messages object with supported locales
const messages = {
  'en-US': en,
  'zh-CN': cn,
};

// Create the i18n instance with configuration
const i18n = createI18n({
  locale: 'zh-CN', // Set default locale
  legacy: false, // Use Composition API mode
  messages, // Set locale messages
  globalInjection: true, // Allow global use of $t in templates
});

/**
 * useLocale - A composition function to get/set the current locale reactively.
 * Returns a computed ref for the current locale.
 */
export const useLocale = () => {
  return computed({
    get() {
      return i18n.global.locale.value;
    },
    set(locale: string) {
      i18n.global.locale.value = locale as 'en-US' | 'zh-CN';
    },
  });
};

// Function to add i18n globally to the app
export const setupI18n = (app) => {
  // Add $t and t to global properties for use in templates and Options API
  Object.assign(app.config.globalProperties, {
    t: i18n.global.t,
  });
  return app;
};

export default i18n;
