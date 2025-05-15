import { defineConfig, devices } from "@playwright/test";
import EmailReporter from "./reports/email-reporter";

export default defineConfig({
  testDir: "./tests",
  timeout: 3000 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [["html"], ["line"], ["./reports/email-reporter.ts"]],

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  use: {
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
