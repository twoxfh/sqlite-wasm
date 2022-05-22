WASI_SDK_PATH ?= /opt/wasi-sdk-14.0
CC = "${WASI_SDK_PATH}/bin/clang"
LD = "${WASI_SDK_PATH}/bin/wasm-ld"

CFLAGS = -x c -Os -flto --target=wasm32 --sysroot=${WASI_SDK_PATH}/share/wasi-sysroot -D__wasi_api_h '-DEXPORT=__attribute__((visibility("default")))'
LDFLAGS = -O9 -m wasm32 -L$(WASI_SDK_PATH)/share/wasi-sysroot/lib/wasm32-wasi --no-entry -lc -lm --export-dynamic "$(WASI_SDK_PATH)/lib/clang/13.0.0/lib/wasi/libclang_rt.builtins-wasm32.a"

.PHONY: all clean

all: sqlite3.wasm

sqlite/sqlite3.o: sqlite/sqlite3.c
	$(CC) $(CFLAGS) \
		-DSQLITE_THREADSAFE=0 \
		-DSQLITE_OS_OTHER=1 \
		'-DSQLITE_API=__attribute__((visibility("default")))' \
		-c sqlite/sqlite3.c \
		-o sqlite/sqlite3.o

os.o: os.c
	$(CC) $(CFLAGS) -c os.c -o os.o

sqlite3.wasm: sqlite/sqlite3.o os.o
	$(LD) $(LDFLAGS) -o sqlite3.wasm sqlite/sqlite3.o os.o

clean:
	rm -f sqlite/*.o
	rm *.o
	rm *.wasm
