CXX      ?= c++
CXXFLAGS ?= -std=c++17 -O2 -g -Wall -Wextra
CPPFLAGS += -Isrc

LIB_SRCS := \
  src/pager/page.cc src/pager/pager.cc src/pager/readwrite.cc src/pager/alloc.cc \
  src/btree/node.cc src/btree/tree.cc src/btree/search.cc src/btree/insert.cc src/btree/check.cc \
  src/db/db.cc

HDRS := $(wildcard src/*/*.h) tests/check.h

.PHONY: test asan run clean

build/btree_test: tests/btree_test.cc tests/memio.h $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/btree_test.cc $(LIB_SRCS)

build/db_test: tests/db_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -pthread -o $@ tests/db_test.cc $(LIB_SRCS)

build/pager_test: tests/pager_test.cc $(filter src/pager/%,$(LIB_SRCS)) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/pager_test.cc src/pager/page.cc src/pager/pager.cc src/pager/readwrite.cc src/pager/alloc.cc

build/btreekv: cmd/btreekv/main.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -pthread -o $@ cmd/btreekv/main.cc $(LIB_SRCS)

test: build/pager_test build/btree_test build/db_test
	./build/pager_test
	./build/btree_test
	./build/db_test

asan: tests/btree_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -O1 -fsanitize=address,undefined -fno-omit-frame-pointer \
		-o build/btree_test_asan tests/btree_test.cc $(LIB_SRCS)
	./build/btree_test_asan

run: build/btreekv
	./build/btreekv

clean:
	rm -rf build
