import { UserProfile } from "@/core/types/user";
import { createApiClient } from "@/utils/apiWrapper";

type UserResponse = {
  status: string;
  user: UserProfile;
};

export const createUserService = (getToken: () => Promise<string | null>) => {
  const USER_API_URL = process.env.EXPO_PUBLIC_API_BASE_URL_USERS || "";

  const getUser = async () => {
    const apiClient = createApiClient({
      baseUrl: USER_API_URL,
      getToken,
    });

    return apiClient.get<UserResponse>("me");
  };

  return { getUser };
};
