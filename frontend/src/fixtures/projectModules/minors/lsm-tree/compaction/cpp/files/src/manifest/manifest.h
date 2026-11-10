#pragma once
#include <cstdint>
#include <string>
#include <vector>
namespace lsmkv { namespace manifest {
inline constexpr const char* kFileName = "MANIFEST";
struct State { uint64_t next_file = 1; std::vector<uint64_t> tables; };
State Load(const std::string& dir);
void Save(const std::string& dir, const State& s);  // student
}} 
