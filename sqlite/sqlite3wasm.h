#include "sqlite3.h"

#ifndef SQLITE_IMPORTED_API
#define SQLITE_IMPORTED_API
#endif

#ifndef SQLITE_EXTRA_API
#define SQLITE_EXTRA_API
#endif

__attribute__((import_module("imports"),import_name("sqlite3_ext_os_init")))
SQLITE_IMPORTED_API int sqlite3_ext_os_init(void);

__attribute__((import_module("imports"),import_name("sqlite3_ext_os_end")))
SQLITE_IMPORTED_API int sqlite3_ext_os_end(void);

__attribute__((import_module("imports"),import_name("sqlite3_ext_exec_callback")))
SQLITE_IMPORTED_API int sqlite3_ext_exec_callback(int id, int nCols, char** azCols, char** azColNames);

__attribute__((import_module("imports"),import_name("sqlite3_ext_io_close")))
SQLITE_IMPORTED_API int sqlite3_ext_io_close(int vfsId, int fileId);

__attribute__((import_module("imports"),import_name("sqlite3_ext_io_read")))
SQLITE_IMPORTED_API int sqlite3_ext_io_read(int vfsId, int fileId, void *pBuf, int iAmt, int iOfst);

__attribute__((import_module("imports"),import_name("sqlite3_ext_io_write")))
SQLITE_IMPORTED_API int sqlite3_ext_io_write(int vfsId, int fileId, const void *pBuf, int iAmt, int iOfst);

__attribute__((import_module("imports"),import_name("sqlite3_ext_io_truncate")))
SQLITE_IMPORTED_API int sqlite3_ext_io_truncate(int vfsId, int fileId, int size);

__attribute__((import_module("imports"),import_name("sqlite3_ext_io_sync")))
SQLITE_IMPORTED_API int sqlite3_ext_io_sync(int vfsId, int fileId, int flags);

__attribute__((import_module("imports"),import_name("sqlite3_ext_io_file_size")))
SQLITE_IMPORTED_API int sqlite3_ext_io_file_size(int vfsId, int fileId, int *pSize);

__attribute__((import_module("imports"),import_name("sqlite3_ext_io_lock")))
SQLITE_IMPORTED_API int sqlite3_ext_io_lock(int vfsId, int fileId, int locktype);

__attribute__((import_module("imports"),import_name("sqlite3_ext_io_unlock")))
SQLITE_IMPORTED_API int sqlite3_ext_io_unlock(int vfsId, int fileId, int locktype);

__attribute__((import_module("imports"),import_name("sqlite3_ext_io_check_reserved_lock")))
SQLITE_IMPORTED_API int sqlite3_ext_io_check_reserved_lock(int vfsId, int fileId, int *pResOut);

__attribute__((import_module("imports"),import_name("sqlite3_ext_io_file_control")))
SQLITE_IMPORTED_API int sqlite3_ext_io_file_control(int vfsId, int fileId, int op, void *pArg);

__attribute__((import_module("imports"),import_name("sqlite3_ext_io_sector_size")))
SQLITE_IMPORTED_API int sqlite3_ext_io_sector_size(int vfsId, int fileId);

__attribute__((import_module("imports"),import_name("sqlite3_ext_io_device_characteristics")))
SQLITE_IMPORTED_API int sqlite3_ext_io_device_characteristics(int vfsId, int fileId);

__attribute__((import_module("imports"),import_name("sqlite3_ext_vfs_open")))
SQLITE_IMPORTED_API int sqlite3_ext_vfs_open(int id, const char *zName, int *pOutfileId, int flags, int *pOutFlags);

__attribute__((import_module("imports"),import_name("sqlite3_ext_vfs_delete")))
SQLITE_IMPORTED_API int sqlite3_ext_vfs_delete(int id, const char *zName, int syncDir);

__attribute__((import_module("imports"),import_name("sqlite3_ext_vfs_access")))
SQLITE_IMPORTED_API int sqlite3_ext_vfs_access(int id, const char *zName, int flags, int *pResOut);

__attribute__((import_module("imports"),import_name("sqlite3_ext_vfs_full_pathname")))
SQLITE_IMPORTED_API int sqlite3_ext_vfs_full_pathname(int id, const char *zName, int nOut, char *zOut);

__attribute__((import_module("imports"),import_name("sqlite3_ext_vfs_randomness")))
SQLITE_IMPORTED_API int sqlite3_ext_vfs_randomness(int id, int nByte, char *zOut);

__attribute__((import_module("imports"),import_name("sqlite3_ext_vfs_sleep")))
SQLITE_IMPORTED_API int sqlite3_ext_vfs_sleep(int id, int microseconds);

__attribute__((import_module("imports"),import_name("sqlite3_ext_vfs_current_time")))
SQLITE_IMPORTED_API int sqlite3_ext_vfs_current_time(int id, double *pTimeOut);

__attribute__((import_module("imports"),import_name("sqlite3_ext_vfs_get_last_error")))
SQLITE_IMPORTED_API int sqlite3_ext_vfs_get_last_error(int id, int nByte, char *zOut);

SQLITE_EXTRA_API int sqlite3_ext_vfs_register(const char *name, int makeDflt, int *pOutVfsId);

SQLITE_EXTRA_API int sqlite3_ext_vfs_unregister(int vfsId);

SQLITE_EXTRA_API int sqlite3_ext_exec(sqlite3 *db, const char *sql, int id, char **errmsg);
