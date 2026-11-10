CXX      ?= c++
CXXFLAGS ?= -std=c++17 -O2 -g -Wall -Wextra -pthread
CPPFLAGS += -Isrc -Itests

LIB_SRCS := \
	src/memtable/skiplist.cc \
	src/memtable/memtable.cc \
	src/memtable/iterator.cc \
	src/wal/crc32c.cc \
	src/wal/record.cc \
	src/wal/writer.cc \
	src/wal/reader.cc \
	src/db/db.cc \
	src/db/recover.cc

HDRS := $(wildcard src/*/*.h) tests/check.h

.PHONY: test asan run clean

build/wal_test: tests/wal_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/wal_test.cc $(LIB_SRCS)

build/db_test: tests/db_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/db_test.cc $(LIB_SRCS)

build/memtable_test: tests/memtable_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/memtable_test.cc $(LIB_SRCS)

build/lsmkv: cmd/lsmkv/main.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ cmd/lsmkv/main.cc $(LIB_SRCS)

test: build/memtable_test build/wal_test build/db_test
	./build/memtable_test
	./build/wal_test
	./build/db_test

asan: tests/wal_test.cc tests/db_test.cc tests/memtable_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -O1 -fsanitize=address,undefined -fno-omit-frame-pointer \
		-o build/memtable_test_asan tests/memtable_test.cc $(LIB_SRCS)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -O1 -fsanitize=address,undefined -fno-omit-frame-pointer \
		-o build/wal_test_asan tests/wal_test.cc $(LIB_SRCS)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -O1 -fsanitize=address,undefined -fno-omit-frame-pointer \
		-o build/db_test_asan tests/db_test.cc $(LIB_SRCS)
	./build/memtable_test_asan
	./build/wal_test_asan
	./build/db_test_asan

run: build/lsmkv
	./build/lsmkv

clean:
	rm -rf build
