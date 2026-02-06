import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layout/index.vue'),
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/views/Home/index.vue'),
        meta: { title: '首页' },
      },
      {
        path: '/:pathMatch(.*)*',
        name: '404',
        component: () => import('@/views/Error/index.vue'),
        meta: { title: '错误' },
      },
    ],
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/Login/index.vue'),
    meta: { title: '登录' },
  },
  {
    path: '/reg',
    name: 'register',
    component: () => import('@/views/Register/index.vue'),
    meta: { title: '注册' },
  },
];

export default routes;
