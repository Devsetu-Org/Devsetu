#include "bloom/bloom.h"
#include "check.h"
#include <string>
using namespace lsmkv::bloom;
TEST(RoundTrip) {
  Builder b(10);
  for (int i = 0; i < 1000; ++i) b.Add("order:" + std::to_string(i));
  std::string f = b.Finish();
  for (int i = 0; i < 1000; ++i) CHECK(MayContain(f, "order:" + std::to_string(i)));
  int misses = 0;
  for (int i = 1000; i < 2000; ++i) if (MayContain(f, "order:" + std::to_string(i))) ++misses;
  CHECK(misses < 50);
}
TEST(ShortFilterPermissive) {
  CHECK(MayContain("", "k"));
  CHECK(MayContain(std::string("\x01", 1), "k"));
}
int main() { return check::RunAll(); }
