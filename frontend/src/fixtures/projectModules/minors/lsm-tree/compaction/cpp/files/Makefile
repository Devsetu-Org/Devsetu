CXX      ?= c++
CXXFLAGS ?= -std=c++17 -O2 -g -Wall -Wextra -pthread
CPPFLAGS += -Isrc -Itests

LIB_SRCS := \
	src/memtable/skiplist.cc src/memtable/memtable.cc src/memtable/iterator.cc \
	src/wal/crc32c.cc src/wal/record.cc src/wal/writer.cc src/wal/reader.cc \
	src/sstable/format.cc src/sstable/writer.cc src/sstable/build.cc \
	src/sstable/reader.cc src/sstable/lookup.cc src/sstable/iterator.cc \
	src/db/db.cc src/db/recover.cc src/db/flush.cc src/db/scan.cc \
	src/bloom/bloom.cc src/iterator/merging.cc \
	src/compaction/compaction.cc src/manifest/manifest.cc src/db/compact.cc

HDRS := $(wildcard src/*/*.h) tests/check.h

.PHONY: test asan run clean

build/manifest_test: tests/manifest_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/manifest_test.cc $(LIB_SRCS)

build/compact_test: tests/compact_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/compact_test.cc $(LIB_SRCS)

build/lsmkv: cmd/lsmkv/main.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ cmd/lsmkv/main.cc $(LIB_SRCS)

# This chapter: compaction merge, manifest, compact.
test: build/manifest_test build/compact_test
	./build/manifest_test
	./build/compact_test

# Apple clang ASan currently hangs on these binaries; UBSan is the feasible check.
asan:
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -O1 -fsanitize=undefined -fno-omit-frame-pointer \
		-o build/manifest_test_asan tests/manifest_test.cc $(LIB_SRCS)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -O1 -fsanitize=undefined -fno-omit-frame-pointer \
		-o build/compact_test_asan tests/compact_test.cc $(LIB_SRCS)
	./build/manifest_test_asan
	./build/compact_test_asan

run: build/lsmkv
	./build/lsmkv

clean:
	rm -rf build
