CXX      ?= c++
CXXFLAGS ?= -std=c++17 -O2 -g -Wall -Wextra -pthread
CPPFLAGS += -Isrc -I.
ASANFLAGS = -O1 -fsanitize=address,undefined -fno-omit-frame-pointer

LIB_SRCS := \
  src/labrpc/labrpc.cc \
  src/storage/mem.cc \
  src/storage/fence.cc \
  src/storage/file.cc \
  src/raft/raft.cc \
  src/raft/rpc.cc \
  src/raft/election.cc \
  src/raft/vote.cc \
  src/raft/replication.cc \
  src/raft/commit.cc \
  src/raft/persist.cc \
  src/raft/service.cc \
  src/raft/debug.cc \
  src/labharness/cluster.cc \
  src/labharness/monitor.cc

HDRS := $(shell find src -name '*.h') tests/check.h

.PHONY: test asan run clean

build/raft_test: tests/raft_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/raft_test.cc $(LIB_SRCS)

build/raftkv: cmd/raftkv/main.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ cmd/raftkv/main.cc $(LIB_SRCS)

test: build/raft_test
	./build/raft_test

asan: tests/raft_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) $(ASANFLAGS) -o build/raft_test_asan tests/raft_test.cc $(LIB_SRCS)
	./build/raft_test_asan

run: build/raftkv
	./build/raftkv

clean:
	rm -rf build
