#include "manifest/manifest.h"
#include <fstream>
#include <sstream>
#include <stdexcept>
namespace lsmkv { namespace manifest {
namespace {
constexpr const char* kHeader = "lsmkv-manifest v1";
std::string Encode(const State& s) {
  std::ostringstream out;
  out << kHeader << "\nnext " << s.next_file << "\n";
  for (auto t : s.tables) out << "table " << t << "\n";
  return out.str();
}
}
State Load(const std::string& dir) {
  std::ifstream in(dir + "/" + kFileName);
  if (!in) return State{1, {}};
  std::string line;
  if (!std::getline(in, line) || line != kHeader) throw std::runtime_error("manifest: corrupt");
  State s; s.next_file = 0;
  while (std::getline(in, line)) {
    if (line.empty()) continue;
    auto sp = line.find(' ');
    if (sp == std::string::npos) throw std::runtime_error("manifest: corrupt");
    auto field = line.substr(0, sp);
    uint64_t n = std::stoull(line.substr(sp + 1));
    if (field == "next") s.next_file = n;
    else if (field == "table") s.tables.push_back(n);
    else throw std::runtime_error("manifest: corrupt");
  }
  if (s.next_file == 0) throw std::runtime_error("manifest: corrupt");
  return s;
}
void Save(const std::string& dir, const State& s) {
  (void)dir; (void)s;
  throw std::logic_error("TODO(5.2): Save");
}
}} 
