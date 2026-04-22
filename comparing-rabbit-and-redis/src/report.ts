import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RunResult } from "./types";

function mdTable(headers: string[], rows: string[][]): string {
  const esc = (c: string) => c.replace(/\|/g, "\\|");
  const head = `| ${headers.map(esc).join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.map(esc).join(" | ")} |`).join("\n");
  return [head, sep, body].join("\n");
}

async function loadResults(resultsDir: string): Promise<RunResult[]> {
  const names = await readdir(resultsDir).catch(() => []);
  const jsonFiles = names.filter((f) => f.endsWith(".json") && f !== "package.json");
  const out: RunResult[] = [];
  for (const f of jsonFiles) {
    try {
      const raw = await readFile(path.join(resultsDir, f), "utf8");
      out.push(JSON.parse(raw) as RunResult);
    } catch {
      /* skip */
    }
  }
  return out;
}

function groupByScenario(rows: RunResult[]): Map<string, RunResult[]> {
  const m = new Map<string, RunResult[]>();
  for (const r of rows) {
    const key = r.scenario.id;
    const list = m.get(key) ?? [];
    list.push(r);
    m.set(key, list);
  }
  return m;
}

async function main(): Promise<void> {
  const resultsDir = path.join(process.cwd(), "results");
  const rows = await loadResults(resultsDir);

  if (rows.length === 0) {
    console.error(`No JSON results found in ${resultsDir}. Run npm run bench first.`);
    process.exitCode = 1;
    return;
  }

  const byScenario = groupByScenario(rows);
  const scenarioIds = [...byScenario.keys()].sort();

  const comparisonRows: string[][] = [];

  for (const sid of scenarioIds) {
    const list = byScenario.get(sid)!;
    const rabbit = list.find((r) => r.broker === "rabbitmq");
    const redis = list.find((r) => r.broker === "redis");
    const label = rabbit?.scenario.label ?? redis?.scenario.label ?? sid;
    const payload = String(rabbit?.scenario.payloadBytes ?? redis?.scenario.payloadBytes ?? "");
    const target = String(rabbit?.scenario.targetMsgPerSec ?? redis?.scenario.targetMsgPerSec ?? "");

    const fmt = (r: RunResult | undefined) =>
      r
        ? `${r.throughputConsumedPerSec.toFixed(0)} / p95 ${r.latency.p95Ms.toFixed(0)}ms / lost ${r.lost}${r.degraded ? " ⚠" : ""}`
        : "—";

    comparisonRows.push([label, payload, target, fmt(rabbit), fmt(redis)]);
  }

  const md: string[] = [];
  md.push("# Отчёт: RabbitMQ vs Redis Streams");
  md.push("");
  md.push("Сгенерировано автоматически из `results/*.json`. Добавьте скриншоты дашбордов и выводы вручную.");
  md.push("");
  md.push("## Сводная таблица (consumer throughput msg/s / p95 / lost)");
  md.push("");
  md.push(
    mdTable(
      ["Сценарий", "Payload (B)", "Цель msg/s", "RabbitMQ", "Redis"],
      comparisonRows,
    ),
  );
  md.push("");
  md.push("## Что дописать в выводах (по заданию)");
  md.push("");
  md.push(
    [
      "- Какой брокер показал большую пропускную способность на вашем железе.",
      "- Какой брокер лучше переносит рост размера сообщения.",
      "- При какой нагрузке single instance RabbitMQ и Redis начали деградировать (очередь, p95, ошибки).",
      "- Какой инструмент нагрузочного теста удобнее для такого сценария и почему (здесь: кастомный Node producer/consumer).",
    ].join("\n"),
  );
  md.push("");
  md.push("## Методология");
  md.push("");
  md.push(
    [
      "- Одинаковый JSON формат сообщения (`id`, `sentAtMs`, `padding`).",
      "- Latency = время от `sentAtMs` до обработки consumer (end-to-end).",
      "- `lost = max(0, sent - consumed)` после drain timeout.",
      "- Деградация: рост backlog, высокий p95, доля ошибок (см. `.env.example`).",
    ].join("\n"),
  );

  const outPath = path.join(process.cwd(), "REPORT.md");
  await writeFile(outPath, md.join("\n"), "utf8");
  console.log(`Wrote ${outPath} (${rows.length} runs parsed)`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
