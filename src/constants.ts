export const SQLiteResultCodes = {
	"SQLITE_OK": 0,
	"SQLITE_ERROR": 1,
	"SQLITE_INTERNAL": 2,
	"SQLITE_PERM": 3,
	"SQLITE_ABORT": 4,
	"SQLITE_BUSY": 5,
	"SQLITE_LOCKED": 6,
	"SQLITE_NOMEM": 7,
	"SQLITE_READONLY": 8,
	"SQLITE_INTERRUPT": 9,
	"SQLITE_IOERR": 10,
	"SQLITE_CORRUPT": 11,
	"SQLITE_NOTFOUND": 12,
	"SQLITE_FULL": 13,
	"SQLITE_CANTOPEN": 14,
	"SQLITE_PROTOCOL": 15,
	"SQLITE_EMPTY": 16,
	"SQLITE_SCHEMA": 17,
	"SQLITE_TOOBIG": 18,
	"SQLITE_CONSTRAINT": 19,
	"SQLITE_MISMATCH": 20,
	"SQLITE_MISUSE": 21,
	"SQLITE_NOLFS": 22,
	"SQLITE_AUTH": 23,
	"SQLITE_FORMAT": 24,
	"SQLITE_RANGE": 25,
	"SQLITE_NOTADB": 26,
	"SQLITE_NOTICE": 27,
	"SQLITE_WARNING": 28,
	"SQLITE_ROW": 100,
	"SQLITE_DONE": 101,
} as const;
export type SQLiteResultCode = typeof SQLiteResultCodes[keyof typeof SQLiteResultCodes];

export const SQLiteDatatypes = {
	"SQLITE_INTEGER": 1,
	"SQLITE_FLOAT": 2,
	"SQLITE_TEXT": 3,
	"SQLITE_BLOB": 4,
	"SQLITE_NULL": 5,
} as const;
export type SQLiteDatatype = typeof SQLiteDatatypes[keyof typeof SQLiteDatatypes];

export const SQLiteResultCodesStr: {
	[key: number]: keyof typeof SQLiteResultCodes
} = Object.fromEntries(Object.entries(SQLiteResultCodes)
	.map(([key, value]) => [value, key as keyof typeof SQLiteResultCodes]));

export const SQLiteDatatypesStr: {
	[key: number]: keyof typeof SQLiteDatatypes
} = Object.fromEntries(Object.entries(SQLiteDatatypes)
	.map(([key, value]) => [value, key as keyof typeof SQLiteDatatypes]));
