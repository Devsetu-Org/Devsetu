CXX      ?= c++
CXXFLAGS ?= -std=c++17 -O2 -g -Wall -Wextra
CPPFLAGS += -Isrc -Itests

LIB_SRCS := \
	src/analyze/stopwords.cc \
	src/analyze/letters.cc \
	src/analyze/analyze.cc
HDRS     := $(wildcard src/*/*.h) tests/check.h

.PHONY: test asan run clean

build/analyze_test: tests/analyze_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ tests/analyze_test.cc $(LIB_SRCS)

build/findx: cmd/findx/main.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -o $@ cmd/findx/main.cc $(LIB_SRCS)

test: build/analyze_test
	./build/analyze_test

asan: tests/analyze_test.cc $(LIB_SRCS) $(HDRS)
	@mkdir -p build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -O1 -fsanitize=address,undefined -fno-omit-frame-pointer \
		-o build/analyze_test_asan tests/analyze_test.cc $(LIB_SRCS)
	./build/analyze_test_asan

run: build/findx
	./build/findx

clean:
	rm -rf build
