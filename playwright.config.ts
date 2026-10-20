import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:17000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } }
  ],
  webServer: [
    { command: "node e2e/api-fixture.mjs", url: "http://127.0.0.1:17000/v1/chain/get_info" },
    {
      command: "node dist/hyperion-explorer/server/server.mjs",
      env: { HYP_EXPLORER_PORT: "17001", HYP_EXPLORER_HOST: "127.0.0.1", HYP_EXPLORER_ALLOWED_HOSTS: "127.0.0.1" },
      url: "http://127.0.0.1:17001/explorer/favicon.ico"
    }
  ]
});
