import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

interface TestResult {
  strategy: string;
  mode: string;
  duration: number;
  concurrency: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  throughput: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p95Latency: number;
  p99Latency: number;
  timestamp: string;
}

async function parseArgs() {
  const args: Record<string, string> = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i].replace('--', '');
    const value = process.argv[i + 1];
    args[key] = value;
  }
  return args;
}

function getModeRatio(mode: string): { readRatio: number; writeRatio: number } {
  switch (mode) {
    case 'read-heavy':
      return { readRatio: 0.8, writeRatio: 0.2 };
    case 'balanced':
      return { readRatio: 0.5, writeRatio: 0.5 };
    case 'write-heavy':
      return { readRatio: 0.2, writeRatio: 0.8 };
    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
}

async function runLoadTest(config: {
  strategy: string;
  mode: string;
  duration: number;
  concurrency: number;
  baseUrl: string;
}): Promise<TestResult> {
  const { strategy, mode, duration, concurrency, baseUrl } = config;
  const { readRatio } = getModeRatio(mode);

  const latencies: number[] = [];
  let totalRequests = 0;
  let successfulRequests = 0;
  let failedRequests = 0;

  const startTime = Date.now();
  const endTime = startTime + duration * 1000;

  console.log(
    chalk.blue(
      `\n🚀 Starting test: strategy=${strategy}, mode=${mode}, duration=${duration}s, concurrency=${concurrency}`,
    ),
  );

  const workers = Array(concurrency)
    .fill(null)
    .map(async () => {
      while (Date.now() < endTime) {
        const isRead = Math.random() < readRatio;
        const productId = Math.floor(Math.random() * 1000) + 1;

        const requestStart = Date.now();
        try {
          if (isRead) {
            await axios.get(`${baseUrl}/${strategy}/${productId}`, { timeout: 5000 });
          } else {
            await axios.put(`${baseUrl}/${strategy}/${productId}`, { stock: 100 }, { timeout: 5000 });
          }
          successfulRequests++;
          latencies.push(Date.now() - requestStart);
        } catch (error) {
          failedRequests++;
        }
        totalRequests++;
      }
    });

  await Promise.all(workers);

  const actualDuration = (Date.now() - startTime) / 1000;
  latencies.sort((a, b) => a - b);

  const result: TestResult = {
    strategy,
    mode,
    duration: Math.round(actualDuration * 100) / 100,
    concurrency,
    totalRequests,
    successfulRequests,
    failedRequests,
    throughput: Math.round((successfulRequests / actualDuration) * 100) / 100,
    avgLatency: Math.round((latencies.reduce((a, b) => a + b, 0) / latencies.length) * 100) / 100,
    minLatency: latencies[0],
    maxLatency: latencies[latencies.length - 1],
    p95Latency: latencies[Math.floor(latencies.length * 0.95)] || 0,
    p99Latency: latencies[Math.floor(latencies.length * 0.99)] || 0,
    timestamp: new Date().toISOString(),
  };

  return result;
}

async function main() {
  const args = await parseArgs();

  const strategy = args.strategy || 'lazy';
  const mode = args.mode || 'balanced';
  const duration = parseInt(args.duration || '30');
  const concurrency = parseInt(args.concurrency || '10');
  const baseUrl = args.baseUrl || 'http://localhost:3000';

  console.log(chalk.cyan('📊 Cache Comparison Load Generator'));
  console.log(chalk.gray('=====================================\n'));

  // Reset metrics before test
  try {
    await axios.put(`${baseUrl}/metrics/reset?strategy=${strategy}`);
  } catch (error) {
    console.warn(chalk.yellow('⚠️  Could not reset metrics'));
  }

  const result = await runLoadTest({ strategy, mode, duration, concurrency, baseUrl });

  // Get final metrics
  let appMetrics: any = {};
  try {
    const response = await axios.get(`${baseUrl}/metrics?strategy=${strategy}`);
    appMetrics = response.data;
  } catch (error) {
    console.warn(chalk.yellow('⚠️  Could not fetch application metrics'));
  }

  console.log(chalk.green('\n✅ Test completed!\n'));
  console.log(chalk.cyan('Load Test Results:'));
  console.table({
    'Strategy': strategy,
    'Mode': mode,
    'Duration (s)': result.duration,
    'Concurrency': result.concurrency,
    'Total Requests': result.totalRequests,
    'Successful': result.successfulRequests,
    'Failed': result.failedRequests,
    'Throughput (req/s)': result.throughput,
    'Avg Latency (ms)': result.avgLatency,
    'Min Latency (ms)': result.minLatency,
    'Max Latency (ms)': result.maxLatency,
    'P95 Latency (ms)': result.p95Latency,
    'P99 Latency (ms)': result.p99Latency,
  });

  if (appMetrics) {
    console.log(chalk.cyan('\nApplication Metrics:'));
    console.table(appMetrics);
  }

  // Save result to file
  const resultsDir = path.join(__dirname, '..', 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const resultFile = path.join(resultsDir, `${strategy}-${mode}-${Date.now()}.json`);
  fs.writeFileSync(resultFile, JSON.stringify({ testConfig: { strategy, mode, duration, concurrency }, result, appMetrics }, null, 2));
  console.log(chalk.gray(`\n📁 Result saved to: ${resultFile}`));
}

main().catch((error) => {
  console.error(chalk.red('❌ Error:'), error.message);
  process.exit(1);
});
