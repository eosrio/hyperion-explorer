import { createFixture } from "./mock-server.mjs";
const port = Number(process.env.HYP_MOCK_PORT || 17000);
const fixture = createFixture({ port, ssrPort: Number(process.env.HYP_MOCK_SSR_PORT || 17001) });
fixture.server.listen(port, "127.0.0.1", () => console.log(`Hyperion mock API + streaming listening on ${port}`));
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    fixture.close();
    process.exit(0);
  });
