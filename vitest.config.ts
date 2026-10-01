import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/**/*.{test,spec}.ts",
      "supabase/functions/**/*.{test,spec}.ts",
    ],
  },
});
