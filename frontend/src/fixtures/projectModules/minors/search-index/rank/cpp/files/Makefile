CXX      ?= c++
CXXFLAGS ?= -std=c++17 -O2 -g -Wall -Wextra
CPPFLAGS += -Isrc -Itests

LIB_SRCS := \
	src/analyze/stopwords.cc \
	src/analyze/letters.cc \
	src/analyze/analyze.cc \
	src/postings/map.cc \
	src/postings/segment.cc \
	src/index/catalog_io.cc \
	src/index/lookup.cc \
	src/index/add.cc \
	src/index/flush.cc \
	src/index/open.cc \
	src/query/parse.cc \
	src/query/bool.cc \
	src/rank/stats.cc \
	src/rank/bm25.cc \
	src/rank/topk.cc \
	src/findx/findx.cc
HDRS     := $(wildcard src/*/*.h) tests/check.h

.PHONY: test asan run clean

build/analyze_test: tests/analyze_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/analyze_test.cc $(LIB_SRCS)
build/postings_test: tests/postings_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/postings_test.cc $(LIB_SRCS)
build/index_test: tests/index_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/index_test.cc $(LIB_SRCS)
build/query_test: tests/query_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/query_test.cc $(LIB_SRCS)
build/rank_test: tests/rank_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/rank_test.cc $(LIB_SRCS)
build/findx_test: tests/findx_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/findx_test.cc $(LIB_SRCS)

build/findx: cmd/findx/main.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ cmd/findx/main.cc $(LIB_SRCS)

test: build/analyze_test build/postings_test build/index_test build/query_test build/rank_test build/findx_test
	./build/analyze_test
	./build/postings_test
	./build/index_test
	./build/query_test
	./build/rank_test
	./build/findx_test

asan: tests/findx_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -O1 -fsanitize=address,undefined -fno-omit-frame-pointer \
		-o build/findx_test_asan tests/findx_test.cc $(LIB_SRCS)
	./build/findx_test_asan

run: build/findx
	./build/findx

clean:
	rm -rf build
