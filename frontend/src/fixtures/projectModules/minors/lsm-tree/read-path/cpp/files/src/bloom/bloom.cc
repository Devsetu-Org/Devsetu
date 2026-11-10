#include "bloom/bloom.h"
#include <stdexcept>
namespace lsmkv { namespace bloom {
Builder::Builder(int bits_per_key) : bits_per_key_(bits_per_key < 1 ? 1 : bits_per_key) {}
void Builder::Add(std::string_view key) { hashes_.push_back(Hash(key)); }
int NumProbes(int bits_per_key) {
  int k = int(bits_per_key * 0.69); if (k < 1) k = 1; if (k > kMaxProbes) k = kMaxProbes; return k;
}
uint32_t Probe(uint64_t h, uint32_t i, uint32_t m) {
  uint32_t h1 = uint32_t(h), h2 = uint32_t(h >> 32); return (h1 + i * h2) % m;
}
uint64_t Hash(std::string_view key) {
  uint64_t h = 14695981039346656037ull;
  for (unsigned char c : key) { h ^= c; h *= 1099511628211ull; }
  h ^= h >> 33; h *= 0xff51afd7ed558ccdull; h ^= h >> 33; h *= 0xc4ceb9fe1a85ec53ull; h ^= h >> 33;
  return h;
}
std::string Builder::Finish() { throw std::logic_error("TODO(4.1): Finish"); }
bool MayContain(std::string_view, std::string_view) { throw std::logic_error("TODO(4.2): MayContain"); }
}} 
