CXX      ?= c++
CXXFLAGS ?= -std=c++17 -O2 -g -Wall -Wextra -pthread
CPPFLAGS += -Isrc

LIB_SRCS := src/lex/token.cc src/lex/lex.cc src/lex/scan.cc
HDRS     := $(wildcard src/lex/*.h) tests/check.h

.PHONY: test asan run clean

build/tinysh_test: tests/tinysh_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/tinysh_test.cc $(LIB_SRCS)

build/tinysh: cmd/tinysh/main.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ cmd/tinysh/main.cc $(LIB_SRCS)

test: build/tinysh_test
	./build/tinysh_test

asan: tests/tinysh_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -O1 -fsanitize=address,undefined -fno-omit-frame-pointer \
		-o build/tinysh_test_asan tests/tinysh_test.cc $(LIB_SRCS)
	./build/tinysh_test_asan

run: build/tinysh
	./build/tinysh

clean:
	rm -rf build
