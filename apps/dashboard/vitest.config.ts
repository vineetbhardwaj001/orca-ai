import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Browser journeys are executed by Playwright through the separate
    // test:e2e script. Keep Vitest scoped to dashboard unit/component tests.
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
