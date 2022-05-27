import * as fs from "fs/promises";
import { argv } from "process";

type InteropTypeName = "CFunctionPointer" | "CPointer" | "CInteger" | "CInteger64" | "CFloat" | "CDouble" | "CString" | "unknown" | "void";

const preamble = `/* auto-generated, do not edit */
export type CPointer = number;
export type CString = number;
export type CInteger = number;
export type CInteger64 = bigint;
export type CFunctionPointer = number;
export type CFloat = number;
export type CDouble = number;

`;

const exportsPreamble = `
export interface SQLiteExports extends WebAssembly.Exports {
`;

const exportsPostamble = `
	memory: WebAssembly.Memory;
}
`;

const importsPreamble = `
export interface SQLiteImports {
`;

const importsPostamble = `}
`;

const unimplementedImportsPreamble = `
export class SQLiteUnimplementedImportError extends Error {
	constructor(api: string) {
		super(api + " is not implemented");
	}
}

export const unimplementedImports: SQLiteImports = {
`;

const unimplementedImportsPostamble = `};
`;

function getArgTypeName(s: string) {
	if (s.includes("(")) {
		return undefined;
	}
	return s.match(/[^()*]*($|\**)/)?.[0]?.replace(/ +\*/g, "*")?.trim() ?? undefined;
}

function stripComments(s: string) {
	return s.replace(/\/\*[^]*?\*\//mg, "");
}

function getArgInteropTypeName(s: string): InteropTypeName {
	if (s.includes("(")) {
		return "CFunctionPointer";
	}
	const typeName = getArgTypeName(s);
	if (typeName === undefined) {
		return "unknown";
	}
	if (typeName === "void") {
		return "void";
	}
	if (typeName === "const char*") {
		return "CString";
	}
	if (typeName.includes("*")) {
		return "CPointer";
	}
	if (typeName.includes("int64")) {
		return "CInteger64";
	}
	if (typeName.includes("int")) {
		return "CInteger";
	}
	if (typeName.includes("float")) {
		return "CFloat";
	}
	if (typeName.includes("double")) {
		return "CDouble";
	}
	return "unknown";
}

function getArgName(s: string) {
	const functionPtrMatch = s.match(/\(\*?([a-zA-Z0-9_]+?)\)/);
	if (functionPtrMatch !== null) {
		if (functionPtrMatch[1].trim() === "") {
			return undefined;
		}
		return functionPtrMatch[1];
	}
	const regularNameMatch = s.match(/ \*?([a-zA-Z0-9_]+?)$/);
	if (regularNameMatch !== null) {
		return regularNameMatch[1];
	}
	return undefined;
}

function splitArgs(s: string) {
	const args: string[] = [];
	let tmp = "";
	let paren = 0;
	for (const c of s) {
		if (paren === 0 && c === ",") {
			args.push(tmp);
			tmp = "";
			continue;
		}
		if (c === "(") {
			paren += 1;
		}
		if (c === ")") {
			paren -= 1;
		}
		tmp = tmp + c;
	}
	args.push(tmp);
	return args.map((x) => x.trim());
}

interface SqliteApiInfo {
	returnType: string;
	returnInteropType: string;
	name: string;
	apiType: string;
	args: {
		name?: string;
		inferredName: string;
		typeName?: string;
		interopTypeName: string;
	}[];
}

function extractApis(header: string): SqliteApiInfo[] {
	const apis = stripComments(header).matchAll(/^(SQLITE_API|SQLITE_EXTRA_API|SQLITE_IMPORTED_API) ([^]*?)([^ *()]+)\(([^]*?)\);/mg);
	const apiInfos: SqliteApiInfo[] = [];
	for (const api of apis) {
		if (api[0].includes("SQLITE_DEPRECATED")) {
			continue;
		}
		const apiType = api[1];
		const returnType = api[2].replace(/\n/g, "").trim();
		const name = api[3].replace(/\n/g, "").trim();
		const args = splitArgs(api[4].replace(/\n/g, ""));
		if (name.includes("16")) {
			// drop utf-16 support
			continue;
		}
		apiInfos.push({
			apiType,
			returnType,
			returnInteropType: getArgInteropTypeName(returnType),
			name,
			args: (args.length === 1 && args[0] === "void") ? [] : args.map((arg, i) => ({
				name: getArgName(arg),
				inferredName: getArgName(arg) ?? String.fromCharCode("a".charCodeAt(0) + i),
				typeName: getArgTypeName(arg),
				interopTypeName: getArgInteropTypeName(arg),
			})),
		});
	}
	return apiInfos;
}

function genInterop(api: SqliteApiInfo) {
	return `${api.name}: (${api.args.map((arg) => `${arg.inferredName}: ${arg.interopTypeName}`).join(", ")}) => ${api.returnInteropType};`
}

function genPlaceholder(api: SqliteApiInfo) {
	return `${api.name}: () => { throw new SQLiteUnimplementedImportError("${api.name}") },`;
}

async function main() {
	const sqliteHeaderFilename = "./sqlite/sqlite3.h";
	const sqliteWasmHeaderFilename = "./sqlite/sqlite3wasm.h";
	const sqliteHeader = await fs.readFile(sqliteHeaderFilename, { encoding: "ascii" });
	const sqliteWasmHeader = await fs.readFile(sqliteWasmHeaderFilename, { encoding: "ascii" });
	const apis = extractApis(sqliteHeader);
	const wasmApis = extractApis(sqliteWasmHeader);

	const exportApis = apis.concat(wasmApis).filter((api) => api.apiType === "SQLITE_API" || api.apiType === "SQLITE_EXTRA_API");
	const importApis = apis.concat(wasmApis).filter((api) => api.apiType === "SQLITE_IMPORTED_API");

	const exportInterops = exportApis.map(genInterop);
	const importInterops = importApis.map(genInterop);

	await fs.writeFile("./src/api.ts", [
		preamble,
		exportsPreamble,
		...exportInterops.map((x) => "\t" + x + "\n"),
		exportsPostamble,
		importsPreamble,
		...importInterops.map((x) => "\t" + x + "\n"),
		importsPostamble,
		unimplementedImportsPreamble,
		...importApis.map(genPlaceholder).map((x) => "\t" + x + "\n"),
		unimplementedImportsPostamble,
	]);
}

main();
