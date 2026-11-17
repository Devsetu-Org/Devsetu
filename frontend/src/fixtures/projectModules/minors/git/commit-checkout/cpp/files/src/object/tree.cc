#include "object/tree.h"
#include <algorithm>
#include <stdexcept>

namespace tinygit {

std::vector<uint8_t> EncodeTree(std::vector<TreeEntry> entries) {
  std::sort(entries.begin(), entries.end(),
            [](const TreeEntry& a, const TreeEntry& b) { return a.name < b.name; });
  std::vector<uint8_t> buf;
  for (const auto& e : entries) {
    if (e.name.empty() || e.name.find('\0') != std::string::npos || e.name.find('/') != std::string::npos)
      throw std::runtime_error("object: bad tree name");
    if (e.mode != kModeFile && e.mode != kModeTree) throw std::runtime_error("object: bad mode");
    std::string head = e.mode + " " + e.name;
    head.push_back('\0');
    buf.insert(buf.end(), head.begin(), head.end());
    buf.insert(buf.end(), e.hash.bytes.begin(), e.hash.bytes.end());
  }
  return buf;
}

std::vector<TreeEntry> DecodeTree(const std::vector<uint8_t>& content) {
  std::vector<TreeEntry> out;
  size_t i = 0;
  while (i < content.size()) {
    size_t space = i;
    while (space < content.size() && content[space] != ' ') ++space;
    if (space >= content.size()) throw std::runtime_error("object: bad tree entry");
    size_t nul = space + 1;
    while (nul < content.size() && content[nul] != 0) ++nul;
    if (nul >= content.size()) throw std::runtime_error("object: bad tree entry name");
    TreeEntry e;
    e.mode.assign(reinterpret_cast<const char*>(&content[i]), space - i);
    e.name.assign(reinterpret_cast<const char*>(&content[space + 1]), nul - (space + 1));
    if (nul + 1 + 20 > content.size()) throw std::runtime_error("object: truncated tree hash");
    std::copy(content.begin() + static_cast<std::ptrdiff_t>(nul + 1),
              content.begin() + static_cast<std::ptrdiff_t>(nul + 1 + 20), e.hash.bytes.begin());
    out.push_back(e);
    i = nul + 1 + 20;
  }
  return out;
}

Hash PutTree(Store s, const std::vector<TreeEntry>& entries) {
  return s.Put(kTypeTree, EncodeTree(entries));
}

std::vector<TreeEntry> GetTree(Store s, const Hash& h) {
  auto pr = s.Get(h);
  if (pr.first != kTypeTree) throw std::runtime_error(std::string("object: want tree got ") + pr.first);
  return DecodeTree(pr.second);
}

}  // namespace tinygit
