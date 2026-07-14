// Local ingestion runner: `npm run ingest`
// Loads .env.local, then runs the full pipeline and prints a summary.

async function main() {
  try {
    process.loadEnvFile?.(".env.local");
  } catch {
    // .env.local optional if vars are already in the environment
  }

  const { runIngestion } = await import("../lib/pipeline/ingest");
  const result = await runIngestion();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
