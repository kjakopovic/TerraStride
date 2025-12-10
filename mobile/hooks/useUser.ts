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

export type UserLevel = {
  level: number;
  currentXp: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  progress: number; // 0 to 1
};

export const calculateUserLevel = (xp: number | undefined): UserLevel => {
  const totalXp = xp ?? 0;
  const xpPerLevel = 1000;

  const level = Math.floor(totalXp / xpPerLevel);
  const xpForCurrentLevel = level * xpPerLevel;
  const xpForNextLevel = (level + 1) * xpPerLevel;
  const xpIntoCurrentLevel = totalXp - xpForCurrentLevel;
  const progress = xpIntoCurrentLevel / xpPerLevel;

  return {
    level,
    currentXp: totalXp,
    xpForCurrentLevel,
    xpForNextLevel,
    progress: Math.min(Math.max(progress, 0), 1),
  };
};

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
