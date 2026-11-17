CXX      ?= c++
CXXFLAGS ?= -std=c++17 -O2 -g -Wall -Wextra
CPPFLAGS += -Isrc

LIB_SRCS := \
  src/pager/page.cc src/pager/pager.cc src/pager/readwrite.cc src/pager/alloc.cc \
  src/btree/node.cc src/btree/tree.cc src/btree/search.cc src/btree/insert.cc src/btree/check.cc \
  src/wal/record.cc src/wal/writer.cc src/wal/reader.cc \
  src/buffer/pool.cc src/buffer/pin.cc src/buffer/evict.cc src/buffer/flush.cc \
  src/db/txn.cc src/db/apply.cc src/db/recover.cc src/db/db.cc

HDRS := $(wildcard src/*/*.h) tests/check.h

.PHONY: test asan run clean

build/pager_test: tests/pager_test.cc $(filter src/pager/%,$(LIB_SRCS)) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/pager_test.cc src/pager/page.cc src/pager/pager.cc src/pager/readwrite.cc src/pager/alloc.cc

build/btree_test: tests/btree_test.cc tests/memio.h $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/btree_test.cc $(LIB_SRCS)

build/wal_test: tests/wal_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/wal_test.cc $(LIB_SRCS)

build/db_wal_test: tests/db_wal_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -pthread -o $@ tests/db_wal_test.cc $(LIB_SRCS)

build/db_test: tests/db_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -pthread -o $@ tests/db_test.cc $(LIB_SRCS)

build/btreekv: cmd/btreekv/main.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -pthread -o $@ cmd/btreekv/main.cc $(LIB_SRCS)

build/buffer_test: tests/buffer_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -pthread -o $@ tests/buffer_test.cc $(LIB_SRCS)

test: build/pager_test build/btree_test build/wal_test build/db_wal_test build/buffer_test build/db_test
	./build/pager_test
	./build/btree_test
	./build/wal_test
	./build/db_wal_test
	./build/buffer_test
	./build/db_test

asan: tests/wal_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -O1 -fsanitize=address,undefined -fno-omit-frame-pointer \
		-o build/wal_test_asan tests/wal_test.cc $(LIB_SRCS)
	./build/wal_test_asan

run: build/btreekv
	./build/btreekv

clean:
	rm -rf build
