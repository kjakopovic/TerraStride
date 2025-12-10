import { createApiClient } from "./apiWrapper";

const territoriesApiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL_TERRITORIES ?? "";

// Create a client without token requirement for logging if possible,
// or pass a dummy token getter if the wrapper requires it.
// Assuming apiWrapper handles optional getTokens gracefully or we can pass a no-op.
const client = createApiClient({
  baseUrl: territoriesApiBaseUrl,
  getTokens: async () => ({ access_token: "", idToken: "" }), // Dummy tokens if needed
});

export const log = async (message: string, data?: any) => {
  try {
    const payload = {
      message,
      data,
      timestamp: new Date().toISOString(),
      platform: "mobile",
    };

    // Fire and forget - don't await the log request to avoid blocking UI
    client
      .post("/logs", { body: payload })
      .catch((err) => console.warn("Failed to send log:", err));

    // Also log to console for development
    if (__DEV__) {
      console.log(`[REMOTE LOG] ${message}`, data);
    }
  } catch (error) {
    console.warn("Error in logger:", error);
  }
};
