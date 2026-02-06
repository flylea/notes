import type {
  NavigationGuardNext,
  RouteLocationNormalized,
  RouteLocationNormalizedLoadedGeneric,
} from 'vue-router';

const titleGuard = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalizedLoadedGeneric,
  next: NavigationGuardNext,
) => {
  document.title = (to.meta.title as string) || '';
  next();
};

export default titleGuard;
