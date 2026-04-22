import { runBenchmarkSuite } from './benchmark-runner';

runBenchmarkSuite().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
