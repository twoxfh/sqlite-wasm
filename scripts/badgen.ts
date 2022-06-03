import * as fs from "fs/promises";
import { badgen } from "badgen";

async function main() {
	await fs.mkdir("./badges", { recursive: true });

	const coverageSummary = await fs.readFile("./coverage/coverage-summary.json", "utf-8").then(JSON.parse);
	const coverage = coverageSummary.total.lines.pct as number;
	const coverageSvg = badgen({
		label: "coverage",
		status: coverage.toFixed(0) + "%",
		color: coverage >= 80 ? "green" : coverage >= 70 ? "yellow" : "red",
		style: "flat",
	});
	await fs.writeFile("./badges/coverage.svg", coverageSvg);

	const packageJson = await fs.readFile("./package.json", "utf-8").then(JSON.parse);
	const version = packageJson.version;
	const versionSvg = badgen({
		label: "npm",
		status: version,
		color: "red",
		style: "flat",
	});
	await fs.writeFile("./badges/npm.svg", versionSvg);
}

main();
