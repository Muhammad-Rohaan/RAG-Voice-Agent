import { api } from '../utils/api';

export const chatApi = {
  sendMessage: async (userQuery) => {
    return await api.sendMessage(userQuery);
  },
  getMessages: async () => {
    return await api.getMessages();
  }
};
