import { UserProfile } from "@/core/types/user";
import { createApiClient } from "@/utils/apiWrapper";

type UserResponse = {
  status: string;
  user: UserProfile;
};

type TokenGetter = () => Promise<{
  access_token: string | null;
  idToken: string | null;
}>;

export const createUserService = (getTokens: TokenGetter) => {
  const USER_API_URL = process.env.EXPO_PUBLIC_API_BASE_URL_USERS || "";

  const getUser = async () => {
    const apiClient = createApiClient({
      baseUrl: USER_API_URL,
      getTokens,
    });

    return apiClient.get<UserResponse>("me");
  };

  return { getUser };
};
