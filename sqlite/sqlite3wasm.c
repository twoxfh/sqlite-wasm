#include <stdlib.h>
#include <string.h>

#include "sqlite3wasm.h"

#ifndef MAX_EXT_VFS
#define MAX_EXT_VFS 32
#endif

static sqlite3_vfs *ext_vfs[MAX_EXT_VFS] = { 0 };

typedef struct sqlite3_ext_file sqlite3_ext_file;
struct sqlite3_ext_file
{
	sqlite3_file base;
	int vfsId;
	int fileId;
};

static int io_close(sqlite3_file *pFile)
{
	sqlite3_ext_file *p = (sqlite3_ext_file *)pFile;
	int rc = sqlite3_ext_io_close(p->vfsId, p->fileId);
	sqlite3_free(p);
	return rc;
}

static int io_read(sqlite3_file *pFile, void *pBuf, int iAmt, sqlite3_int64 iOfst)
{
	sqlite3_ext_file *p = (sqlite3_ext_file *)pFile;
	return sqlite3_ext_io_read(p->vfsId, p->fileId, pBuf, iAmt, iOfst);
}

static int io_write(sqlite3_file *pFile, const void *pBuf, int iAmt, sqlite3_int64 iOfst)
{
	sqlite3_ext_file *p = (sqlite3_ext_file *)pFile;
	return sqlite3_ext_io_write(p->vfsId, p->fileId, pBuf, iAmt, iOfst);
}

static int io_truncate(sqlite3_file *pFile, sqlite3_int64 size)
{
	sqlite3_ext_file *p = (sqlite3_ext_file *)pFile;
	return sqlite3_ext_io_truncate(p->vfsId, p->fileId, size);
}

static int io_sync(sqlite3_file *pFile, int flags)
{
	sqlite3_ext_file *p = (sqlite3_ext_file *)pFile;
	return sqlite3_ext_io_sync(p->vfsId, p->fileId, flags);
}

static int io_file_size(sqlite3_file *pFile, sqlite3_int64 *pSize)
{
	sqlite3_ext_file *p = (sqlite3_ext_file *)pFile;
	int size = 0;
	int rc = sqlite3_ext_io_file_size(p->vfsId, p->fileId, &size);
	*pSize = size;
	return rc;
}

static int io_lock(sqlite3_file *pFile, int locktype)
{
	sqlite3_ext_file *p = (sqlite3_ext_file *)pFile;
	return sqlite3_ext_io_lock(p->vfsId, p->fileId, locktype);
}

static int io_unlock(sqlite3_file *pFile, int locktype)
{
	sqlite3_ext_file *p = (sqlite3_ext_file *)pFile;
	return sqlite3_ext_io_unlock(p->vfsId, p->fileId, locktype);
}

static int io_check_reserved_lock(sqlite3_file *pFile, int *pResOut)
{
	sqlite3_ext_file *p = (sqlite3_ext_file *)pFile;
	return sqlite3_ext_io_check_reserved_lock(p->vfsId, p->fileId, pResOut);
}

static int io_file_control(sqlite3_file *pFile, int op, void *pArg)
{
	sqlite3_ext_file *p = (sqlite3_ext_file *)pFile;
	return sqlite3_ext_io_file_control(p->vfsId, p->fileId, op, pArg);
}

static int io_sector_size(sqlite3_file *pFile)
{
	sqlite3_ext_file *p = (sqlite3_ext_file *)pFile;
	return sqlite3_ext_io_sector_size(p->vfsId, p->fileId);
}

static int io_device_characteristics(sqlite3_file *pFile)
{
	sqlite3_ext_file *p = (sqlite3_ext_file *)pFile;
	return sqlite3_ext_io_device_characteristics(p->vfsId, p->fileId);
}

static sqlite3_io_methods io_methods = {
	1,
	io_close,
	io_read,
	io_write,
	io_truncate,
	io_sync,
	io_file_size,
	io_lock,
	io_unlock,
	io_check_reserved_lock,
	io_file_control,
	io_sector_size,
	io_device_characteristics,
};

static int vfs_open(sqlite3_vfs *vfs, const char *zName, sqlite3_file *file, int flags, int *pOutFlags)
{
	int id = (int)vfs->pAppData;
	int fileId = 0;
	int rc = sqlite3_ext_vfs_open(id, zName, &fileId, flags, pOutFlags);
	if (fileId == 0) {
		return SQLITE_MISUSE;
	}
	if (rc == SQLITE_OK)
	{
		sqlite3_ext_file *ext = (sqlite3_ext_file *)file;
		ext->base.pMethods = &io_methods;
		ext->vfsId = id;
		ext->fileId = fileId;
	}
	return rc;
}

static int vfs_delete(sqlite3_vfs *vfs, const char *zName, int syncDir)
{
	int id = (int)vfs->pAppData;
	return sqlite3_ext_vfs_delete(id, zName, syncDir);
}

static int vfs_access(sqlite3_vfs *vfs, const char *zName, int flags, int *pResOut)
{
	int id = (int)vfs->pAppData;
	return sqlite3_ext_vfs_access(id, zName, flags, pResOut);
}

static int vfs_full_pathname(sqlite3_vfs *vfs, const char *zName, int nOut, char *zOut)
{
	int id = (int)vfs->pAppData;
	return sqlite3_ext_vfs_full_pathname(id, zName, nOut, zOut);
}

static void *vfs_dlopen(sqlite3_vfs *vfs, const char *zFilename)
{
	return NULL;
}

static void vfs_dlerror(sqlite3_vfs *vfs, int nByte, char *zErrMsg)
{
	if (nByte > 0)
	{
		strncpy(zErrMsg, "Dynamic linking not supported", nByte - 1);
		zErrMsg[nByte - 1] = '\0';
	}
}

static int vfs_randomness(sqlite3_vfs *vfs, int nByte, char *zOut)
{
	int id = (int)vfs->pAppData;
	return sqlite3_ext_vfs_randomness(id, nByte, zOut);
}

static int vfs_sleep(sqlite3_vfs *vfs, int microseconds)
{
	int id = (int)vfs->pAppData;
	return sqlite3_ext_vfs_sleep(id, microseconds);
}

static int vfs_current_time(sqlite3_vfs *vfs, double *pTimeOut)
{
	int id = (int)vfs->pAppData;
	return sqlite3_ext_vfs_current_time(id, pTimeOut);
}

static int vfs_get_last_error(sqlite3_vfs *vfs, int nByte, char *zOut)
{
	int id = (int)vfs->pAppData;
	return sqlite3_ext_vfs_get_last_error(id, nByte, zOut);
}

static int next_ext_vfs_id()
{
	for (int i = 0; i < MAX_EXT_VFS; i++)
	{
		if (ext_vfs[i] == NULL)
		{
			return i;
		}
	}
	return -1;
}

static int exec_callback(void *pArg, int nCols, char **azCols, char **azColNames)
{
	return sqlite3_ext_exec_callback((int)pArg, nCols, azCols, azColNames);
}

int sqlite3_ext_vfs_register(const char *name, int makeDflt, int *pOutVfsId)
{
	int vfsId = next_ext_vfs_id();
	if (vfsId < 0)
	{
		return SQLITE_NOMEM;
	}

	if (pOutVfsId == NULL)
	{
		return SQLITE_MISUSE;
	}

	sqlite3_vfs *vfs = sqlite3_malloc(sizeof(sqlite3_vfs));
	if (vfs == NULL) {
		return SQLITE_NOMEM;
	}
	memset(vfs, 0, sizeof(sqlite3_vfs));

	if (name == NULL) {
		name = "ext";
	}

	char *nameCopy = sqlite3_malloc(strlen(name) + 1);
	if (nameCopy == NULL) {
		sqlite3_free(vfs);
		return SQLITE_NOMEM;
	}
	strcpy(nameCopy, name);

	vfs->iVersion = 1;
	vfs->szOsFile = sizeof(sqlite3_ext_file);
	vfs->mxPathname = 256;
	vfs->zName = nameCopy;
	vfs->pAppData = (void *)vfsId;
	vfs->xOpen = vfs_open;
	vfs->xDelete = vfs_delete;
	vfs->xAccess = vfs_access;
	vfs->xFullPathname = vfs_full_pathname;
	vfs->xDlOpen = vfs_dlopen;
	vfs->xDlError = vfs_dlerror;
	vfs->xDlSym = NULL;
	vfs->xDlClose = NULL;
	vfs->xRandomness = vfs_randomness;
	vfs->xSleep = vfs_sleep;
	vfs->xCurrentTime = vfs_current_time;
	vfs->xGetLastError = vfs_get_last_error;

	int rc = sqlite3_vfs_register(vfs, makeDflt);

	if (rc == SQLITE_OK)
	{
		*pOutVfsId = (int)vfs->pAppData;
		ext_vfs[vfsId] = vfs;
		return SQLITE_OK;
	}

	sqlite3_free(nameCopy);
	sqlite3_free(vfs);

	return rc;
}

int sqlite3_ext_vfs_unregister(int vfsId)
{
	if (ext_vfs[vfsId] == NULL)
	{
		return SQLITE_ERROR;
	}
	int rc = sqlite3_vfs_unregister(ext_vfs[vfsId]);
	if (rc == SQLITE_OK)
	{
		sqlite3_free((void *)(ext_vfs[vfsId]->zName));
		sqlite3_free(ext_vfs[vfsId]);
		ext_vfs[vfsId] = NULL;
	}
	return rc;
}

int sqlite3_os_init()
{
	return sqlite3_ext_os_init();
}

int sqlite3_os_end()
{
	return sqlite3_ext_os_end();
}

int sqlite3_ext_exec(sqlite3 *db, const char *sql, int id, char **errmsg)
{
	return sqlite3_exec(db, sql, exec_callback, (void *)id, errmsg);
}
