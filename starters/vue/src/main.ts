import { createApp } from 'vue';
import App from './App.vue';
import { bootstrap } from './bootstrap';

import '@/styles/index.css';

import 'virtual:svg-icons-register';

const app = createApp(App);

const initApplication = async () => {
  await bootstrap(app);

  app.mount('#app');
};

initApplication();
