import { useCallback, useMemo } from "react";
import * as SecureStore from "expo-secure-store";
import { createApiClient } from "@/utils/apiWrapper";

const USERS_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL_USERS ?? "";

type StoredTokens = {
  access_token: string | null;
  idToken: string | null;
};

export const useAuth = () => {
  const getTokens = useCallback(async (): Promise<StoredTokens> => {
    const [accessToken, idToken] = await Promise.all([
      SecureStore.getItemAsync("accessToken"),
      SecureStore.getItemAsync("idToken"),
    ]);
    return { access_token: accessToken, idToken };
  }, []);

  const apiClient = useMemo(
    () =>
      createApiClient({
        baseUrl: USERS_BASE_URL,
        getTokens,
      }),
    [getTokens]
  );

  const login = useCallback(
    async ({ email, password }: LoginPayload) => {
      const response = await apiClient.post<LoginResponse>("login", {
        body: { email, password },
      });

      if (typeof response?.accessToken === "string") {
        await SecureStore.setItemAsync("accessToken", response.accessToken);
      }
      if (typeof response?.idToken === "string") {
        await SecureStore.setItemAsync("idToken", response.idToken);
      }

      return response;
    },
    [apiClient]
  );

  const register = useCallback(
    async ({
      username,
      email,
      password,
      passphrase,
      passcode,
    }: {
      email: string;
      password: string;
      username: string;
      passphrase: string;
      passcode: string;
    }) =>
      apiClient.post("register", {
        body: { username, email, password, passphrase, passcode },
      }),
    [apiClient]
  );

  const emailConfirmation = useCallback(
    async ({ email, code }: { email: string; code: string }) =>
      apiClient.post("register/confirm", {
        body: { email, code },
      }),
    [apiClient]
  );

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync("accessToken");
  }, []);

  return useMemo(
    () => ({ login, register, emailConfirmation, logout, getTokens }),
    [login, register, emailConfirmation, logout, getTokens]
  );
};

type LoginPayload = {
  email: string;
  password: string;
};

type LoginResponse = {
  status: string;
  message: string;
  accessToken?: string;
  idToken?: string;
};
