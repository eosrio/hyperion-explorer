import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createFixture } from "./mock-server.mjs";

const port = Number(process.env.HYP_MOCK_PORT || 17100);
const ssrPort = Number(process.env.HYP_MOCK_SSR_PORT || 17101);
const entry = process.env.HYP_MOCK_DIST || "dist/mock/server/server.mjs";
if (!existsSync(entry)) throw new Error(`Missing ${entry}. Run bun run mock to build the preview first.`);
const fixture = createFixture({ port, ssrPort });
const ssr = spawn(process.execPath, [entry], {
  stdio: "inherit",
  env: { ...process.env, HYP_EXPLORER_HOST: "127.0.0.1", HYP_EXPLORER_PORT: String(ssrPort), HYP_EXPLORER_ALLOWED_HOSTS: "127.0.0.1" }
});
fixture.server.on("error", error => {
  console.error(error.message);
  ssr.kill();
  process.exitCode = 1;
});
fixture.server.listen(port, "127.0.0.1", () =>
  console.log(
    `\nLocal explorer: http://127.0.0.1:${port}/explorer/\nScenarios: http://127.0.0.1:${port}/__fixture/scenarios\nCtrl+C stops the API, streaming and SSR preview.\n`
  )
);
const close = () => {
  fixture.close();
  ssr.kill();
};
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, close);
ssr.on("exit", code => {
  fixture.close();
  process.exitCode = code || 0;
});
