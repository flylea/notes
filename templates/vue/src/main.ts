import { createPinia } from 'pinia';

import persist from 'pinia-plugin-persistedstate';

import '@/styles/index.css';

import 'virtual:svg-icons-register';

import { createApp } from 'vue';

import i18n, { setupI18n } from '@/i18n';
import router from '@/router';

import App from './App.vue';

const pinia = createPinia();
pinia.use(persist);

const app = createApp(App);

// Setup i18n globally
setupI18n(app);

app.use(pinia).use(router).use(i18n).mount('#app');
