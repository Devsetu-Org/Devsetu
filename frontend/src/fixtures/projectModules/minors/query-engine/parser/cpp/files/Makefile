CXX      ?= c++
CXXFLAGS ?= -std=c++17 -O2 -g -Wall -Wextra
CPPFLAGS += -Isrc

LIB_SRCS := src/lex/token.cc src/lex/lex.cc src/lex/scan.cc src/parse/ast.cc src/parse/parser.cc src/parse/expr.cc src/parse/select.cc
HDRS     := $(wildcard src/*/*.h) tests/check.h

.PHONY: test asan run clean

build/sqlq_test: tests/sqlq_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/sqlq_test.cc $(LIB_SRCS)

build/sqlq: cmd/sqlq/main.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ cmd/sqlq/main.cc $(LIB_SRCS)

test: build/sqlq_test
	./build/sqlq_test

asan: tests/sqlq_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -O1 -fsanitize=address,undefined -fno-omit-frame-pointer \
		-o build/sqlq_test_asan tests/sqlq_test.cc $(LIB_SRCS)
	./build/sqlq_test_asan

run: build/sqlq
	./build/sqlq

clean:
	rm -rf build
