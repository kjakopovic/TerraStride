import { createApiClient } from "@/utils/apiWrapper";
import * as SecureStore from "expo-secure-store";

const USERS_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL_USERS ?? "";

export const useAuth = () => {
  const getTokens = async () => null;

  const apiClient = createApiClient({
    baseUrl: USERS_BASE_URL,
    getToken: getTokens,
  });

  const login = async ({ email, password }: LoginPayload) => {
    const response = await apiClient.post<LoginResponse>("login", {
      body: { email, password },
    });

    const accessToken = response?.accessToken;
    if (typeof accessToken === "string" && accessToken.length > 0) {
      await SecureStore.setItemAsync("accessToken", accessToken);
    }

    return response;
  };

  const register = async ({
    username,
    email,
    password,
    passcode,
  }: {
    email: string;
    password: string;
    username: string;
    passcode: string;
  }) =>
    apiClient.post("/register", {
      body: { username, email, password, passcode },
    });

  const emailConfirmation = async ({
    email,
    code,
  }: {
    email: string;
    code: string;
  }) =>
    apiClient.post("/verification/send", {
      body: { email, confirmation_code: code },
    });

  const logout = () => {
    // Implement logout logic here
  };

  return {
    login,
    register,
    emailConfirmation,
    logout,
    getTokens,
  };
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
