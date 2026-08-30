#!/usr/bin/env node
// Appends a coverage-summary.json's totals as a Markdown table to the
// GitHub Actions Job Summary. Usage: coverage-summary.mjs <path> <title>
import { readFileSync, appendFileSync } from "node:fs";

const [, , summaryPath, title] = process.argv;
if (!summaryPath || !title) {
  console.error("usage: coverage-summary.mjs <coverage-summary.json> <title>");
  process.exit(1);
}

const { total } = JSON.parse(readFileSync(summaryPath, "utf8"));
const metrics = ["statements", "branches", "functions", "lines"];

const rows = metrics
  .map((m) => `| ${m} | ${total[m].pct}% | ${total[m].covered}/${total[m].total} |`)
  .join("\n");

const table = `### ${title}\n\n| Metric | Coverage | Covered/Total |\n| --- | --- | --- |\n${rows}\n`;

appendFileSync(process.env.GITHUB_STEP_SUMMARY, table);
