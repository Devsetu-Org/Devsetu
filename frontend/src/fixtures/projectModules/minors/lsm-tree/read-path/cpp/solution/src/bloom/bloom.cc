#include "bloom/bloom.h"
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
std::string Builder::Finish() {
  int nBits = int(hashes_.size()) * bits_per_key_;
  if (nBits < kMinBits) nBits = kMinBits;
  int nBytes = (nBits + 7) / 8;
  uint32_t m = uint32_t(nBytes * 8);
  int k = NumProbes(bits_per_key_);
  std::string filter(nBytes + 1, '\0');
  filter[nBytes] = char(k);
  for (uint64_t h : hashes_) for (int i = 0; i < k; ++i) {
    uint32_t bit = Probe(h, uint32_t(i), m);
    filter[bit / 8] |= char(1 << (bit % 8));
  }
  return filter;
}
bool MayContain(std::string_view filter, std::string_view key) {
  if (filter.size() < 2) return true;
  int k = int(uint8_t(filter.back()));
  if (k < 1 || k > kMaxProbes) return true;
  uint32_t m = uint32_t((filter.size() - 1) * 8);
  uint64_t h = Hash(key);
  for (int i = 0; i < k; ++i) {
    uint32_t bit = Probe(h, uint32_t(i), m);
    if ((uint8_t(filter[bit / 8]) & (1 << (bit % 8))) == 0) return false;
  }
  return true;
}
}} 
