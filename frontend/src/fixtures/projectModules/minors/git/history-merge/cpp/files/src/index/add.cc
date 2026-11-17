#include "index/add.h"
#include "index/codec.h"
#include "object/blob.h"
#include "object/tree.h"
#include <fstream>
#include <vector>
#include <sstream>
#include <stdexcept>

namespace tinygit {
namespace {
bool HasDotDot(const std::string& p) {
  std::stringstream ss(p);
  std::string part;
  while (std::getline(ss, part, '/')) {
    if (part == "..") return true;
  }
  return false;
}
std::string NormPath(std::string rel) {
  // simple: collapse // and .
  std::vector<std::string> parts;
  std::stringstream ss(rel);
  std::string part;
  while (std::getline(ss, part, '/')) {
    if (part.empty() || part == ".") continue;
    if (part == "..") { if (!parts.empty()) parts.pop_back(); else parts.push_back(".."); continue; }
    parts.push_back(part);
  }
  std::string out;
  for (size_t i = 0; i < parts.size(); ++i) {
    if (i) out += "/";
    out += parts[i];
  }
  return out.empty() ? "." : out;
}
}  // namespace

void Add(const Repo& r, const std::string& rel_in) {
  std::string rel = NormPath(rel_in);
  if (rel == "." || HasDotDot(rel)) throw std::runtime_error("index: bad path");
  std::string abs = r.Root() + "/" + rel;
  std::ifstream f(abs, std::ios::binary);
  if (!f) throw std::runtime_error("index: cannot read file");
  std::vector<uint8_t> data((std::istreambuf_iterator<char>(f)), {});
  Store s = r.Objects();
  Hash h = PutBlob(s, data);
  Index idx = LoadIndex(r.IndexPath());
  idx.Set(IndexEntry{rel, kModeFile, h});
  SaveIndex(r.IndexPath(), idx);
}

}  // namespace tinygit
