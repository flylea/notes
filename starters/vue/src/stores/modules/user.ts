import { defineStore } from 'pinia';

export const useUserStore = defineStore('user', () => {
  const id = ref<string>('');
  const token = ref<string>('');
  const setUserId = (newId: string) => {
    id.value = newId;
  };
  const setUserToken = (newToken: string) => {
    token.value = newToken;
  };

  const getUserId = (): string => id.value;

  const getUserToken = (): string => token.value;

  return {
    id,
    token,
    setUserId,
    setUserToken,
    getUserId,
    getUserToken,
  };
});
