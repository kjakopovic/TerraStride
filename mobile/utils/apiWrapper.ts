export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export type ApiWrapperOptions = {
  baseUrl: string;
  getTokens?: () =>
    | Promise<{ access_token: string | null; idToken: string | null }>
    | { access_token: string | null; idToken: string | null };
  defaultHeaders?: Record<string, string>;
};

export type RequestConfig = {
  method?: HttpMethod;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
};

const buildUrl = (
  baseUrl: string,
  path: string,
  query?: RequestConfig["query"]
) => {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  const queryString = query
    ? Object.entries(query)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(
          ([key, value]) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
        )
        .join("&")
    : "";

  const url = `${normalizedBase}/${normalizedPath}`;
  return queryString ? `${url}?${queryString}` : url;
};

export const createApiClient = ({
  baseUrl,
  getTokens,
  defaultHeaders,
}: ApiWrapperOptions) => {
  const request = async <T>(path: string, config: RequestConfig = {}) => {
    const { method = "GET", headers, query, body } = config;

    const url = buildUrl(baseUrl, path, query);
    const token = getTokens ? await getTokens() : null;

    const resolvedHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...defaultHeaders,
      ...headers,
    };

    if (token?.access_token) {
      resolvedHeaders.access_token = token.access_token;
    }
    if (token?.idToken) {
      resolvedHeaders.Authorization = `Bearer ${token.idToken}`;
    }

    console.log("[API ⇢]", method, url, {
      headers: resolvedHeaders,
      body,
    });

    const response = await fetch(url, {
      method,
      headers: resolvedHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    console.log("[API ⇠]", method, url, {
      status: response.status,
      payload,
    });

    if (!response.ok) {
      const error = new Error("API request failed");
      (error as any).status = response.status;
      (error as any).payload = payload;
      throw error;
    }

    return payload as T;
  };

  return {
    get: <T>(path: string, config?: Omit<RequestConfig, "method" | "body">) =>
      request<T>(path, { ...config, method: "GET" }),
    post: <T>(path: string, config?: Omit<RequestConfig, "method">) =>
      request<T>(path, { ...config, method: "POST" }),
    put: <T>(path: string, config?: Omit<RequestConfig, "method">) =>
      request<T>(path, { ...config, method: "PUT" }),
    patch: <T>(path: string, config?: Omit<RequestConfig, "method">) =>
      request<T>(path, { ...config, method: "PATCH" }),
    delete: <T>(path: string, config?: Omit<RequestConfig, "method">) =>
      request<T>(path, { ...config, method: "DELETE" }),
    request,
  };
};
