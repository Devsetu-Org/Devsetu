#pragma once
#include <cstdio>
#include <cstdlib>
#include <string>

inline int g_failed = 0;

#define CHECK(cond) do { \
  if (!(cond)) { \
    std::fprintf(stderr, "CHECK failed: %s (%s:%d)\n", #cond, __FILE__, __LINE__); \
    g_failed = 1; \
  } \
} while (0)

#define CHECK_EQ(a, b) do { \
  auto _a = (a); auto _b = (b); \
  if (!(_a == _b)) { \
    std::fprintf(stderr, "CHECK_EQ failed: %s == %s (%s:%d)\n", #a, #b, __FILE__, __LINE__); \
    g_failed = 1; \
  } \
} while (0)

#define REQUIRE(cond) do { \
  if (!(cond)) { \
    std::fprintf(stderr, "REQUIRE failed: %s (%s:%d)\n", #cond, __FILE__, __LINE__); \
    std::exit(1); \
  } \
} while (0)
