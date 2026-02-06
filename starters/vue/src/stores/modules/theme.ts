import { defineStore } from 'pinia';
export const useThemeStore = defineStore('theme', () => {
  const theme = ref<'light' | 'dark'>('light');
  localStorage.setItem('theme', theme.value);

  const setTheme = (newTheme: string) => {
    localStorage.setItem('theme', newTheme);
    const html = document.documentElement;
    html.classList.remove('light', 'dark');
    html.classList.add(newTheme);
    theme.value = newTheme;
  };

  return {
    theme,
    setTheme,
  };
});
