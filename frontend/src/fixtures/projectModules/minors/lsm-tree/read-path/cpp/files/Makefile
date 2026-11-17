CXX      ?= c++
CXXFLAGS ?= -std=c++17 -O2 -g -Wall -Wextra -pthread
CPPFLAGS += -Isrc -Itests

LIB_SRCS := \
	src/memtable/skiplist.cc src/memtable/memtable.cc src/memtable/iterator.cc \
	src/wal/crc32c.cc src/wal/record.cc src/wal/writer.cc src/wal/reader.cc \
	src/sstable/format.cc src/sstable/writer.cc src/sstable/build.cc \
	src/sstable/reader.cc src/sstable/lookup.cc src/sstable/iterator.cc \
	src/db/db.cc src/db/recover.cc src/db/flush.cc src/db/scan.cc \
	src/bloom/bloom.cc src/iterator/merging.cc

HDRS := $(wildcard src/*/*.h) tests/check.h

.PHONY: test asan run clean

build/bloom_test: tests/bloom_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/bloom_test.cc $(LIB_SRCS)

build/merging_test: tests/merging_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/merging_test.cc $(LIB_SRCS)

build/scan_test: tests/scan_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/scan_test.cc $(LIB_SRCS)

build/lsmkv: cmd/lsmkv/main.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ cmd/lsmkv/main.cc $(LIB_SRCS)

# This chapter: Bloom, merging iterator, scan.
test: build/bloom_test build/merging_test build/scan_test
	./build/bloom_test
	./build/merging_test
	./build/scan_test

# Apple clang ASan currently hangs on these binaries; UBSan is the feasible check.
asan:
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -O1 -fsanitize=undefined -fno-omit-frame-pointer \
		-o build/bloom_test_asan tests/bloom_test.cc $(LIB_SRCS)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -O1 -fsanitize=undefined -fno-omit-frame-pointer \
		-o build/merging_test_asan tests/merging_test.cc $(LIB_SRCS)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -O1 -fsanitize=undefined -fno-omit-frame-pointer \
		-o build/scan_test_asan tests/scan_test.cc $(LIB_SRCS)
	./build/bloom_test_asan
	./build/merging_test_asan
	./build/scan_test_asan

run: build/lsmkv
	./build/lsmkv

clean:
	rm -rf build
