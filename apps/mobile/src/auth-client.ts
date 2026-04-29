import { createAuthClient } from "better-auth/client";
import { jwtClient } from "better-auth/client/plugins";

const baseURL = process.env.EXPO_PUBLIC_AUTH_URL ?? "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL,
  plugins: [jwtClient()],
});
