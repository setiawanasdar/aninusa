import { defineConfig } from "vitest/config";
import path from "node:path";

const root = __dirname;
const alias = {
  "@": path.join(root, "apps/web/src"),
  "server-only": path.join(root, "test/server-only.ts"),
  "client-only": path.join(root, "test/server-only.ts"),
  "@aninusa/types": path.join(root, "packages/types/src/index.ts"),
  "@aninusa/utils": path.join(root, "packages/utils/src/index.ts"),
  "@aninusa/database": path.join(root, "packages/database/src/index.ts"),
  "@aninusa/source-adapters": path.join(root, "packages/source-adapters/src/index.ts"),
  "@aninusa/services": path.join(root, "packages/services/src/index.ts"),
  "@aninusa/player": path.join(root, "packages/player/src/index.ts"),
};

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.{ts,tsx}", "apps/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/generated/**", "**/dist/**"],
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    restoreMocks: true,
    testTimeout: 15_000,
  },
  resolve: { alias },
  esbuild: { jsx: "automatic" },
});
