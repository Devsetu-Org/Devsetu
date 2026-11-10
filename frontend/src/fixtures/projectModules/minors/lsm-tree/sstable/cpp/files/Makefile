CXX      ?= c++
CXXFLAGS ?= -std=c++17 -O2 -g -Wall -Wextra -pthread
CPPFLAGS += -Isrc -Itests

LIB_SRCS := \
	src/memtable/skiplist.cc src/memtable/memtable.cc src/memtable/iterator.cc \
	src/wal/crc32c.cc src/wal/record.cc src/wal/writer.cc src/wal/reader.cc \
	src/sstable/format.cc src/sstable/writer.cc src/sstable/build.cc \
	src/sstable/reader.cc src/sstable/lookup.cc src/sstable/iterator.cc \
	src/db/db.cc src/db/recover.cc src/db/flush.cc

HDRS := $(wildcard src/*/*.h) tests/check.h

.PHONY: test asan run clean

build/memtable_test: tests/memtable_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/memtable_test.cc $(LIB_SRCS)

build/wal_test: tests/wal_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/wal_test.cc $(LIB_SRCS)

build/db_test: tests/db_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/db_test.cc $(LIB_SRCS)

build/sstable_test: tests/sstable_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/sstable_test.cc $(LIB_SRCS)

build/flush_test: tests/flush_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/flush_test.cc $(LIB_SRCS)

build/lsmkv: cmd/lsmkv/main.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ cmd/lsmkv/main.cc $(LIB_SRCS)

test: build/memtable_test build/wal_test build/db_test build/sstable_test build/flush_test
	./build/memtable_test
	./build/wal_test
	./build/db_test
	./build/sstable_test
	./build/flush_test

asan:
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -O1 -fsanitize=address,undefined -fno-omit-frame-pointer \
		-o build/sstable_test_asan tests/sstable_test.cc $(LIB_SRCS)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -O1 -fsanitize=address,undefined -fno-omit-frame-pointer \
		-o build/flush_test_asan tests/flush_test.cc $(LIB_SRCS)
	./build/sstable_test_asan
	./build/flush_test_asan

run: build/lsmkv
	./build/lsmkv

clean:
	rm -rf build
