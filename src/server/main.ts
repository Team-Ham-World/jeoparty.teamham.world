import next from "next";
import { engine } from "@/features/engine";
import { createApp } from "./app";
import { loadConfig } from "./config";

async function main() {
  const config = loadConfig();
  const dev = process.argv.includes("--dev");
  const nextApp = next({
    dev,
    dir: process.cwd(),
    hostname: config.host,
    port: config.port,
  });
  await nextApp.prepare();
  const app = await createApp(config, {
    engine,
    fallback: nextApp.getRequestHandler(),
    upgradeFallback: nextApp.getUpgradeHandler(),
  });
  await app.listen();
  console.log(
    `HAM Quiz listening on ${config.publicOrigin} (${config.ham.mode} authentication)`,
  );
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await app.close();
    await nextApp.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => {
    void stop();
  });
  process.on("SIGINT", () => {
    void stop();
  });
}
void main().catch(() => {
  console.error(
    "HAM Quiz startup failed. Check configuration, packs and database compatibility.",
  );
  process.exit(1);
});
