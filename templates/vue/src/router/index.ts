import { createRouter, createWebHistory } from 'vue-router';
import routes from './routes';
import titleGuard from '@/middleware';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

// 路由前置守卫
router.beforeEach(titleGuard);

export default router;
