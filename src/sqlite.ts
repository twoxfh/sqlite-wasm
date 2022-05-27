import { SQLiteExports, CPointer, SQLiteImports, unimplementedImports } from "./api";
import { SQLiteResultCodes, SQLiteDatatype, SQLiteDatatypes } from "./constants";

import { SQLiteError, SQLiteUtils } from "./utils";

type ScalarIn = string | number | boolean | bigint | ArrayBuffer | null;
type ScalarOut = string | number | bigint | ArrayBuffer | null;

export class SQLite {
	private readonly instance: WebAssembly.Instance;
	public readonly utils: SQLiteUtils;
	public readonly exports: SQLiteExports;

	public _execCallback: SQLiteImports["sqlite3_ext_exec_callback"] | undefined;

	public static instantiate(module: WebAssembly.Module): Promise<SQLite>;
	public static instantiate(module: WebAssembly.Module, async: true): Promise<SQLite>;
	public static instantiate(module: WebAssembly.Module, async: false): SQLite;
	public static instantiate(module: WebAssembly.Module, async: boolean = true): Promise<SQLite> | SQLite {
		let sqlite: SQLite;

		const imports: SQLiteImports = {
			...unimplementedImports,
			sqlite3_ext_vfs_current_time: (_, pTimeOut) => {
				const f64 = sqlite.utils.f64;
				f64[pTimeOut / 8] = Date.now() / 86400000 + 2440587.5;
				return SQLiteResultCodes.SQLITE_OK;
			},
			sqlite3_ext_vfs_randomness: globalThis?.crypto?.getRandomValues !== undefined ? (_, nByte, zOut) => {
				const u8 = new Uint8Array(nByte);
				globalThis.crypto.getRandomValues(u8.slice(zOut, zOut + nByte));
				return SQLiteResultCodes.SQLITE_OK;
			} : (_, nByte, zOut) => {
				const u8 = new Uint8Array(nByte);
				for (let i = 0; i < nByte; i++) {
					u8[zOut + i] = Math.floor(Math.random() * 256);
				}
				return SQLiteResultCodes.SQLITE_OK;
			},
			sqlite3_ext_os_init: () => {
				const pId = sqlite.utils.malloc(4);
				const rc = sqlite.exports.sqlite3_ext_vfs_register(0, 1, pId);
				if (rc !== SQLiteResultCodes.SQLITE_OK) {
					throw new Error(`Failed to register VFS: ${rc}`);
				}
				sqlite.utils.free(pId);
				return SQLiteResultCodes.SQLITE_OK;
			},
			sqlite3_ext_os_end: () => {
				return SQLiteResultCodes.SQLITE_OK;
			},
			sqlite3_ext_exec_callback: (i, nCols, azCols, azColNames) => {
				return sqlite._execCallback!(i, nCols, azCols, azColNames);
			},
		};

		if (async) {
			return (async () => {
				const instance = await WebAssembly.instantiate(module, {
					imports: {
						...imports,
					},
				});
		
				sqlite = new SQLite(instance);
				sqlite.initialize();
				return sqlite;
			})();
		} else {
			const instance = new WebAssembly.Instance(module, {
				imports: {
					...imports,
				},
			});
			sqlite = new SQLite(instance);
			sqlite.initialize();
			return sqlite;
		}
	}

	public constructor(instance: WebAssembly.Instance) {
		this.instance = instance;
		this.exports = this.instance.exports as SQLiteExports;
		this.utils = new SQLiteUtils(this.exports);
	}

	public initialize(): void {
		const rc = this.exports.sqlite3_initialize();
		if (rc !== SQLiteResultCodes.SQLITE_OK) {
			throw new SQLiteError(rc);
		}
	}

	public open(filename: string): SQLiteDB {
		const filenamePtr = this.utils.cString(filename);
		const ppDb = this.exports.sqlite3_malloc(4);
		const rc = this.exports.sqlite3_open(filenamePtr, ppDb);
		this.utils.free(filenamePtr);
		if (rc !== SQLiteResultCodes.SQLITE_OK) {
			throw new SQLiteError(rc);
		}
		const pDb = this.utils.deref32(ppDb);
		this.utils.free(ppDb);
		return new SQLiteDB(this, pDb);
	}
}

export interface SQLiteExecValue {
	name: string;
	value: string | null;
}

export class SQLiteDB {
	public readonly utils: SQLiteUtils;
	public readonly exports: SQLiteExports;

	constructor(public readonly sqlite: SQLite, public pDb: CPointer) {
		this.utils = sqlite.utils;
		this.exports = sqlite.exports;
	}

	public prepare(sql: string): SQLiteStatement | null;
	public prepare(sql: string, callback: (stmt: SQLiteStatement) => void): void;
	public prepare(sql: string, callback?: (stmt: SQLiteStatement) => void): SQLiteStatement | null | void {
		if (callback !== undefined) {
			let nextSql: string | undefined = sql;
			while (true) {
				if (nextSql === undefined) {
					return;
				}
				const stmt: SQLiteStatement | null = this.prepare(nextSql);
				if (stmt === null) {
					return;
				}
				try {
					callback(stmt);
				} catch (e) {
					stmt.finalize();
					throw e;
				}
				stmt.finalize();
				nextSql = stmt.tail;
			}
		}
		const zSql = this.utils.cString(sql);
		const ppStmt = this.exports.sqlite3_malloc(4);
		const pzTail = this.exports.sqlite3_malloc(4);
		const rc = this.exports.sqlite3_prepare_v2(this.pDb, zSql, -1, ppStmt, pzTail);
		if (rc !== SQLiteResultCodes.SQLITE_OK) {
			this.utils.free(zSql);
			this.utils.free(ppStmt);
			this.utils.free(pzTail);
			throw this.utils.lastError(this.pDb);
		}
		const pStmt = this.utils.deref32(ppStmt);
		const zTail = this.utils.deref32(pzTail);
		let tail: string | undefined;
		if (zTail !== 0) {
			tail = this.utils.decodeString(zTail);
		}
		const consumedSql = this.utils.textDecoder.decode(this.utils.u8.slice(zSql, zTail));
		this.utils.free(zSql);
		this.utils.free(ppStmt);
		this.utils.free(pzTail);
		if (pStmt === 0) {
			return null;
		}
		return new SQLiteStatement(this, pStmt, consumedSql, tail);
	}

	public exec(sql: string): SQLiteExecValue[][] {
		const results: SQLiteExecValue[][] = [];
		const pSql = this.utils.cString(sql);
		const pzErr = this.utils.malloc(4);
	
		this.sqlite._execCallback = (i, nCols, azCols, azColNames) => {
			const result: SQLiteExecValue[] = [];
			results.push(result);
			for (let i = 0; i < nCols; i++) {
				const zCol = this.utils.deref32(azCols + i * 4);
				const zColName = this.utils.deref32(azColNames + i * 4);
				const colName = this.utils.decodeString(zColName);
				result.push({ name: colName, value: zCol === 0 ? null : this.utils.decodeString(zCol) });
			}
			return SQLiteResultCodes.SQLITE_OK;
		};
		const rc = this.exports.sqlite3_ext_exec(this.pDb, pSql, 0, pzErr);
		this.utils.free(pSql);
		this.utils.free(pzErr);
		if (rc !== SQLiteResultCodes.SQLITE_OK) {
			throw this.utils.lastError(this.pDb);
		}
		return results;
	}

	public serialize(schema: string = "main", mFlags: number = 0): ArrayBuffer | null {
		const zSchema = this.utils.cString(schema);
		const piSize = this.exports.sqlite3_malloc(8);
		const pOut = this.exports.sqlite3_serialize(this.pDb, zSchema, piSize, mFlags);
		const size = this.utils.deref32(piSize);
		this.utils.free(zSchema);
		this.utils.free(piSize);
		let out: Uint8Array | null = null;
		if (pOut !== 0) {
			out = new Uint8Array(size);
			out.set(this.utils.u8.slice(pOut, pOut + size));
			this.exports.sqlite3_free(pOut);
		}
		return out;
	}

	public deserialize(data: ArrayBuffer, schema: string = "main", mFlags: number = 0): void {
		const zSchema = this.utils.cString(schema);
		const pData = this.utils.malloc(data.byteLength);
		this.utils.u8.set(new Uint8Array(data), pData);
		const rc = this.exports.sqlite3_deserialize(
			this.pDb,
			zSchema,
			pData,
			BigInt(data.byteLength),
			BigInt(data.byteLength),
			mFlags & 1, // clear the SQLITE_DESERIALIZE_FREEONCLOSE flag
		);
		this.utils.free(zSchema);
		this.utils.free(pData);
		if (rc !== SQLiteResultCodes.SQLITE_OK) {
			throw this.utils.lastError(this.pDb);
		}
	}

	public close(): void {
		const rc = this.exports.sqlite3_close(this.pDb);
		if (rc !== SQLiteResultCodes.SQLITE_OK) {
			throw new SQLiteError(rc);
		}
	}
}

export class SQLiteStatement {
	public readonly utils: SQLiteUtils;
	public readonly exports: SQLiteExports;

	constructor(
		public readonly db: SQLiteDB,
		private pStmt: CPointer,
		public readonly sql?: string,
		public readonly tail?: string
	) {
		this.utils = db.utils;
		this.exports = db.exports;
	}

	public columnCount(): number {
		return this.exports.sqlite3_column_count(this.pStmt);
	}

	public bindText(i: number, text: string): void {
		const textPtr = this.utils.cString(text);
		const rc = this.exports.sqlite3_bind_text(this.pStmt, i, textPtr, -1, -1);
		if (rc !== SQLiteResultCodes.SQLITE_OK) {
			throw this.utils.lastError(this.db.pDb);
		}
		this.utils.free(textPtr);
	}

	public bindBlob(i: number, buf: ArrayBuffer): void {
		const view = new Uint8Array(buf);
		const ptr = this.utils.malloc(view.length);
		this.utils.u8.set(view, ptr);
		const rc = this.exports.sqlite3_bind_blob(this.pStmt, i, ptr, view.length, -1);
		if (rc !== SQLiteResultCodes.SQLITE_OK) {
			throw this.utils.lastError(this.db.pDb);
		}
		this.utils.free(ptr);
	}

	public bindDouble(i: number, d: number): void {
		const rc = this.exports.sqlite3_bind_double(this.pStmt, i, d);
		if (rc !== SQLiteResultCodes.SQLITE_OK) {
			throw this.utils.lastError(this.db.pDb);
		}
	}

	public bindInt(i: number, i32: number): void {
		const rc = this.exports.sqlite3_bind_int(this.pStmt, i, i32);
		if (rc !== SQLiteResultCodes.SQLITE_OK) {
			throw this.utils.lastError(this.db.pDb);
		}
	}

	public bindInt64(i: number, i64: bigint): void {
		const rc = this.exports.sqlite3_bind_int64(this.pStmt, i, i64);
		if (rc !== SQLiteResultCodes.SQLITE_OK) {
			throw this.utils.lastError(this.db.pDb);
		}
	}

	public bindNull(i: number): void {
		const rc = this.exports.sqlite3_bind_null(this.pStmt, i);
		if (rc !== SQLiteResultCodes.SQLITE_OK) {
			throw this.utils.lastError(this.db.pDb);
		}
	}

	public bindValue(i: number, value: ScalarIn): void {
		if (value === null) {
			return this.bindNull(i);
		}
		if (typeof value === "string") {
			return this.bindText(i, value);
		}
		if (typeof value === "number") {
			return this.bindDouble(i, value);
		}
		if (typeof value === "boolean") {
			return this.bindInt(i, value ? 1 : 0);
		}
		if (typeof value === "bigint") {
			return this.bindInt64(i, value);
		}
		if (value instanceof ArrayBuffer) {
			return this.bindBlob(i, value);
		}
		throw new Error(`Unsupported type ${typeof value}: ${value}`);
	}

	public bind(...values: ScalarIn[]): void {
		for (let i = 0; i < values.length; i++) {
			this.bindValue(i + 1, values[i]);
		}
	}

	public step(): boolean {
		const rc = this.exports.sqlite3_step(this.pStmt);
		if (rc === SQLiteResultCodes.SQLITE_ROW) {
			return true;
		} else if (rc === SQLiteResultCodes.SQLITE_OK || rc === SQLiteResultCodes.SQLITE_DONE) {
			return false;
		} else {
			throw this.utils.lastError(this.db.pDb);
		}
	}

	public reset(): void {
		const rc = this.exports.sqlite3_reset(this.pStmt);
		if (rc !== SQLiteResultCodes.SQLITE_OK) {
			throw this.utils.lastError(this.db.pDb);
		}
	}

	public columnType(i: number): SQLiteDatatype {
		return this.exports.sqlite3_column_type(this.pStmt, i) as SQLiteDatatype;
	}

	public columnName(i: number): string {
		const namePtr = this.exports.sqlite3_column_name(this.pStmt, i);
		const name = this.utils.decodeString(namePtr);
		return name;
	}

	public columnText(i: number): string {
		const ptr = this.exports.sqlite3_column_text(this.pStmt, i);
		const text = this.utils.decodeString(ptr);
		return text;
	}

	public columnBlob(i: number): ArrayBuffer {
		const ptr = this.exports.sqlite3_column_blob(this.pStmt, i);
		const len = this.exports.sqlite3_column_bytes(this.pStmt, i);
		const buf = new Uint8Array(len);
		const window = this.utils.u8.subarray(ptr, ptr + len);
		buf.set(window);
		return buf.buffer;
	}

	public columnDouble(i: number): number {
		return this.exports.sqlite3_column_double(this.pStmt, i);
	}

	public columnInt(i: number): number {
		return this.exports.sqlite3_column_int(this.pStmt, i);
	}

	public columnInt64(i: number): bigint {
		return this.exports.sqlite3_column_int64(this.pStmt, i);
	}

	public columnDecltype(i: number): string | null {
		const zDecltype = this.exports.sqlite3_column_decltype(this.pStmt, i);
		if (zDecltype === 0) {
			return null;
		}
		return this.utils.decodeString(zDecltype);
	}

	public columnValue(i: number): ScalarOut;
	public columnValue(i: number, noBigInt: true): string | number | ArrayBuffer | null;
	public columnValue(i: number, noBigInt: false): ScalarOut;
	public columnValue(i: number, noBigInt: boolean): ScalarOut;
	public columnValue(i: number, noBigInt?: boolean): ScalarOut {
		const type = this.columnType(i);
		switch (type) {
			case SQLiteDatatypes.SQLITE_NULL:
				return null;
			case SQLiteDatatypes.SQLITE_TEXT:
				return this.columnText(i);
			case SQLiteDatatypes.SQLITE_BLOB:
				return this.columnBlob(i);
			case SQLiteDatatypes.SQLITE_INTEGER:
				if (noBigInt || globalThis.BigInt === undefined) {
					return this.columnInt(i);
				}
				return this.columnInt64(i);
			case SQLiteDatatypes.SQLITE_FLOAT:
				return this.columnDouble(i);
			default:
				throw new Error(`Unknown column type: ${type}`);
		}
	}

	public columns(): ScalarOut[];
	public columns(noBigInt: true): (string | number | ArrayBuffer | null)[];
	public columns(noBigInt: false): ScalarOut[];
	public columns(noBigInt: boolean): ScalarOut[];
	public columns(noBigInt?: boolean): ScalarOut[] {
		const columns = [];
		const count = this.columnCount();
		for (let i = 0; i < count; i++) {
			columns.push(this.columnValue(i, noBigInt ?? false));
		}
		return columns;
	}

	public finalize(): void {
		const rc = this.exports.sqlite3_finalize(this.pStmt);
		if (rc !== 0) {
			throw this.utils.lastError(this.db.pDb);
		}
		this.pStmt = 0;
	}
}
