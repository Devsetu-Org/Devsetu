CXX      ?= c++
CXXFLAGS ?= -std=c++17 -O2 -g -Wall -Wextra
CPPFLAGS += -Isrc
LDFLAGS  += -lz

LIB_SRCS := src/object/hash.cc src/object/header.cc src/object/store.cc src/object/blob.cc src/object/tree.cc src/object/commit.cc src/repo/repo.cc
HDRS     := $(wildcard src/*/*.h) tests/check.h

.PHONY: test asan run clean

build/tinygit_test: tests/tinygit_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/tinygit_test.cc $(LIB_SRCS) $(LDFLAGS)

build/tinygit: cmd/tinygit/main.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ cmd/tinygit/main.cc $(LIB_SRCS) $(LDFLAGS)

test: build/tinygit_test
	./build/tinygit_test

asan: tests/tinygit_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -O1 -fsanitize=address,undefined -fno-omit-frame-pointer \
		-o build/tinygit_test_asan tests/tinygit_test.cc $(LIB_SRCS) $(LDFLAGS)
	./build/tinygit_test_asan

run: build/tinygit
	./build/tinygit

clean:
	rm -rf build
