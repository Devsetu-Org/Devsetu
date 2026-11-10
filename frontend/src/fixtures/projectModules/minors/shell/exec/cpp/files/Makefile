CXX      ?= c++
CXXFLAGS ?= -std=c++17 -O2 -g -Wall -Wextra -pthread
CPPFLAGS += -Isrc

LIB_SRCS := \
  src/lex/token.cc src/lex/lex.cc src/lex/scan.cc \
  src/parse/parse.cc src/parse/redir.cc src/parse/pipeline.cc src/parse/bg.cc \
  src/exec/shell.cc src/exec/path.cc src/exec/run.cc src/exec/spawn.cc \
  src/exec/open.cc src/exec/apply.cc src/exec/builtin.cc src/exec/builtin_redir.cc \
  src/exec/pipe.cc src/exec/wait.cc src/exec/jobs.cc src/exec/signal.cc

HDRS := $(shell find src -name '*.h') tests/check.h

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
