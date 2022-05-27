import * as fs from "fs/promises";

import * as assert from "assert";
import { SQLite } from "../src";

async function initModule() {
	const wasm = await fs.readFile("./sqlite/sqlite3.wasm");
	const module = await WebAssembly.compile(wasm);
	return module;
}

const modulePromise = initModule();

async function initDb() {
	const module = await modulePromise;
	const sqlite = await SQLite.instantiate(module);
	return sqlite.open(":memory:");
}

describe("SQLite", function () {
	it("should support synchronous init", async function() {
		const module = await modulePromise;
		const sqlite = SQLite.instantiate(module, false);
		const db = sqlite.open(":memory:");
		const stmt = db.prepare("SELECT SQLITE_VERSION()")!;
		const columnCount = stmt.columnCount();
		assert.equal(columnCount, 1);
		const values: string[] = [];
		while (stmt.step()) {
			for (let i = 0; i < columnCount; i++) {
				values.push(stmt.columnText(i));
			}
		}
		assert.equal(values.length, 1);
		assert(values[0].startsWith("3."));
		stmt.finalize();
		db.close();
	});

	it("should return version", async function() {
		const db = await initDb();
		const stmt = db.prepare("SELECT SQLITE_VERSION()")!;
		const columnCount = stmt.columnCount();
		assert.equal(columnCount, 1);
		const values: string[] = [];
		while (stmt.step()) {
			for (let i = 0; i < columnCount; i++) {
				values.push(stmt.columnText(i));
			}
		}
		assert.equal(values.length, 1);
		assert(values[0].startsWith("3."));
		stmt.finalize();
		db.close();
	});

	it("should return current time", async function() {
		const db = await initDb();
		const stmt = db.prepare("SELECT DATETIME()")!;
		const columnCount = stmt.columnCount();
		assert.equal(columnCount, 1);
		const values: string[] = [];
		while (stmt.step()) {
			for (let i = 0; i < columnCount; i++) {
				values.push(stmt.columnText(i));
			}
		}
		assert.equal(values.length, 1);
		assert(values[0].startsWith("20"));
		stmt.finalize();
		db.close();
	});

	it("should support randomness", async function() {
		const db = await initDb();
		const stmt = db.prepare("SELECT RANDOM(), RANDOM()")!;
		const columnCount = stmt.columnCount();
		assert.equal(columnCount, 2);
		const values: string[] = [];
		while (stmt.step()) {
			for (let i = 0; i < columnCount; i++) {
				values.push(stmt.columnText(i));
			}
		}
		assert.equal(values.length, 2);
		assert.notEqual(values[0], values[1]);
		stmt.finalize();
		db.close();
	});

	it("should support parameterized query", async function() {
		const db = await initDb();
		const stmt = db.prepare("SELECT ?")!;
		stmt.bindInt(1, 1);
		const columnCount = stmt.columnCount();
		assert.equal(columnCount, 1);
		const values: number[] = [];
		while (stmt.step()) {
			for (let i = 0; i < columnCount; i++) {
				values.push(stmt.columnInt(i));
			}
		}
		stmt.finalize();
		assert.equal(values.length, 1);
		assert.equal(values[0], 1);
		db.close();
	});

	it("should support exec", async function() {
		const db = await initDb();
		db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");
		db.exec("INSERT INTO test (value) VALUES ('hello')");
		db.exec("INSERT INTO test (value) VALUES ('hello')");
		db.exec("INSERT INTO test (value) VALUES ('hello')");
		const rows = db.exec("SELECT SQLITE_VERSION(); SELECT * FROM test;");
		assert.equal(rows.length, 4);
		db.close();
	});

	it("should support decltype", async function() {
		const db = await initDb();
		db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");
		db.exec("INSERT INTO test (value) VALUES ('hello')");
		db.prepare("SELECT * FROM test", (stmt) => {
			const columnCount = stmt.columnCount();
			assert.equal(columnCount, 2);
			while (stmt.step()) {
				for (let i = 0; i < columnCount; i++) {
					const decltype = stmt.columnDecltype(i);
					switch (i) {
						case 0:
							assert.equal(decltype, "INTEGER");
							break;
						case 1:
							assert.equal(decltype, "TEXT");
							break;
					}
				}
			}
		});
		db.close();
	});

	it("should support prepare with multiple statements", async function() {
		const db = await initDb();
		const stmt = db.prepare("SELECT DATETIME(); SELECT DATETIME(); SELECT DATETIME()")!;
		assert.equal(stmt.sql, "SELECT DATETIME();");
		assert.equal(stmt.tail, " SELECT DATETIME(); SELECT DATETIME()");
		stmt.finalize();
		db.close();
	});

	it("should support prepare with callback", async function() {
		const db = await initDb();
		let count = 0;
		db.prepare("SELECT DATETIME(); SELECT DATETIME(); SELECT DATETIME()", (stmt) => {
			const columnCount = stmt.columnCount();
			assert.equal(columnCount, 1);
			const values: string[] = [];
			while (stmt.step()) {
				for (let i = 0; i < columnCount; i++) {
					values.push(stmt.columnText(i));
				}
			}
			assert.equal(values.length, 1);
			assert(values[0].startsWith("20"));
			count += 1;
		});
		assert.equal(count, 3);
		db.close();
	});

	it("should support bigint", async function () {
		const db = await initDb();
		db.prepare("SELECT RANDOM()", (stmt) => {
			const columnCount = stmt.columnCount();
			assert.equal(columnCount, 1);
			while (stmt.step()) {
				for (let i = 0; i < columnCount; i++) {
					const col = stmt.columnInt64(i);
					assert(typeof col === "bigint");
					const col2 = stmt.columnValue(i);
					assert(typeof col2 === "bigint");
					const col3 = stmt.columnValue(i, true);
					assert(typeof col3 === "number");
				}
			}
		});
		db.close();
	});

	it("should support prepare with a noop query", async function() {
		const db = await initDb();
		let count = 0;
		db.prepare(";;;;;", () => {
			count += 1;
		});
		assert.equal(count, 0);
		db.close();
	});

	it("should serialize and deserialize", async function() {
		const db = await initDb();
		db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");
		db.exec("INSERT INTO test (value) VALUES ('hello')");
		const buf = db.serialize();
		const textDecoder = new TextDecoder();
		if (buf === null) {
			throw new Error("serialize failed");
		}
		const text = textDecoder.decode(buf.slice(0, 16));
		assert.equal(text, "SQLite format 3\x00");

		db.exec("INSERT INTO test (value) VALUES ('hello2')");

		db.deserialize(buf);
		db.prepare("SELECT COUNT(*) FROM test", (stmt) => {
			const columnCount = stmt.columnCount();
			assert.equal(columnCount, 1);
			const values: number[] = [];
			while (stmt.step()) {
				for (let i = 0; i < columnCount; i++) {
					values.push(stmt.columnInt(i));
				}
			}
			assert.equal(values.length, 1);
			assert.equal(values[0], 1);
		});

		db.close();
	});
});

