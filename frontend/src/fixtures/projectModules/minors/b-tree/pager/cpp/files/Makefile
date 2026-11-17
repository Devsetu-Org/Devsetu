CXX      ?= c++
CXXFLAGS ?= -std=c++17 -O2 -g -Wall -Wextra
CPPFLAGS += -Isrc

LIB_SRCS := src/pager/page.cc src/pager/pager.cc src/pager/readwrite.cc src/pager/alloc.cc
HDRS     := $(wildcard src/*/*.h) tests/check.h

.PHONY: test asan run clean

build/pager_test: tests/pager_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/pager_test.cc $(LIB_SRCS)

build/btreekv: cmd/btreekv/main.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ cmd/btreekv/main.cc $(LIB_SRCS)

test: build/pager_test
	./build/pager_test

asan: tests/pager_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -O1 -fsanitize=address,undefined -fno-omit-frame-pointer \
		-o build/pager_test_asan tests/pager_test.cc $(LIB_SRCS)
	./build/pager_test_asan

run: build/btreekv
	./build/btreekv

clean:
	rm -rf build
