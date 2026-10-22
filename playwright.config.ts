import { defineConfig, devices } from "@playwright/test";
const apiPort = 17200;
const ssrPort = 17201;
const dist = process.env["HYP_E2E_DIST"] || "dist/hyperion-explorer";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: `http://127.0.0.1:${apiPort}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } }
  ],
  webServer: [
    {
      command: "node e2e/api-fixture.mjs",
      env: { HYP_MOCK_PORT: String(apiPort), HYP_MOCK_SSR_PORT: String(ssrPort) },
      url: `http://127.0.0.1:${apiPort}/v1/chain/get_info`
    },
    {
      command: `node ${dist}/server/server.mjs`,
      env: { HYP_EXPLORER_PORT: String(ssrPort), HYP_EXPLORER_HOST: "127.0.0.1", HYP_EXPLORER_ALLOWED_HOSTS: "127.0.0.1" },
      url: `http://127.0.0.1:${ssrPort}/explorer/favicon.ico`
    }
  ]
});
