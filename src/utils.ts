import type { SQLiteExports, CString } from "./api";
import { SQLiteResultCodes, SQLiteResultCodesStr } from "./constants";

export class SQLiteError extends Error {
	constructor(public code: number, public extendedCode?: number, message?: string) {
		super(message ?? SQLiteResultCodesStr[code] ?? "Unknown error");
	}
}

export class SQLiteUtils {
	public readonly textEncoder: TextEncoder;
	public readonly textDecoder: TextDecoder;

	constructor(private exports: SQLiteExports) {
		this.textEncoder = new TextEncoder();
		this.textDecoder = new TextDecoder();
	}

	public get u8() {
		return new Uint8Array(this.exports.memory.buffer);
	}

	public get u32() {
		return new Uint32Array(this.exports.memory.buffer);
	}

	public get f64() {
		return new Float64Array(this.exports.memory.buffer);
	}

	public malloc(size: number): number {
		return this.exports.sqlite3_malloc(size);
	}

	public free(ptr: number): void {
		this.exports.sqlite3_free(ptr);
	}

	public cString(s: string): CString {
		const view = this.u8;
		const buf = this.textEncoder.encode(s);
		const ptr = this.malloc(buf.length + 1);
		view.set(buf, ptr);
		view[ptr + buf.length] = 0;
		return ptr;
	}

	public decodeString(ptr: number): string {
		const view = this.u8;
		let end = ptr;
		while (view[end] !== 0) {
			end++;
		}
		const buf = view.slice(ptr, end);
		return this.textDecoder.decode(buf);
	}

	public deref32(ptr: number): number {
		const view = this.u32;
		return view[(ptr / 4) | 0];
	}

	public lastError(dbPtr: number): SQLiteError | undefined {
		const code = this.exports.sqlite3_errcode(dbPtr);
		if (code === SQLiteResultCodes.SQLITE_OK) {
			return undefined;
		}
		const extendedCode = this.exports.sqlite3_extended_errcode(dbPtr);
		const message = this.decodeString(this.exports.sqlite3_errmsg(dbPtr));
		return new SQLiteError(code, extendedCode, message);
	}
}
