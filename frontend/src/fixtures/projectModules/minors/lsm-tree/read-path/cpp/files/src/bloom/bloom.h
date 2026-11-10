#pragma once
#include <cstdint>
#include <string>
#include <string_view>
#include <vector>
namespace lsmkv { namespace bloom {
constexpr int kMinBits = 64;
constexpr int kMaxProbes = 30;
class Builder {
 public:
  explicit Builder(int bits_per_key);
  void Add(std::string_view key);
  std::string Finish();  // student
 private:
  int bits_per_key_;
  std::vector<uint64_t> hashes_;
};
bool MayContain(std::string_view filter, std::string_view key);  // student
int NumProbes(int bits_per_key);
uint32_t Probe(uint64_t h, uint32_t i, uint32_t m);
uint64_t Hash(std::string_view key);
}} 
