#include "index/codec.h"
#include <algorithm>
#include <fstream>
#include <sstream>
#include <stdexcept>

namespace tinygit {

IndexEntry* Index::Get(const std::string& path) {
  for (auto& e : entries) if (e.path == path) return &e;
  return nullptr;
}
const IndexEntry* Index::Get(const std::string& path) const {
  for (const auto& e : entries) if (e.path == path) return &e;
  return nullptr;
}
void Index::Set(const IndexEntry& e) {
  for (auto& cur : entries) {
    if (cur.path == e.path) { cur = e; return; }
  }
  entries.push_back(e);
}
void Index::Remove(const std::string& path) {
  entries.erase(std::remove_if(entries.begin(), entries.end(),
                               [&](const IndexEntry& e) { return e.path == path; }),
                entries.end());
}

std::vector<uint8_t> EncodeIndex(Index idx) {
  // TODO(3.1): EncodeIndex
  throw std::runtime_error("TODO(3.1): EncodeIndex");
}

Index DecodeIndex(const std::vector<uint8_t>& data) {
  // TODO(3.1): DecodeIndex
  throw std::runtime_error("TODO(3.1): DecodeIndex");
}

Index LoadIndex(const std::string& path) {
  std::ifstream f(path, std::ios::binary);
  if (!f) return Index{};
  std::vector<uint8_t> data((std::istreambuf_iterator<char>(f)), {});
  return DecodeIndex(data);
}

void SaveIndex(const std::string& path, const Index& idx) {
  auto data = EncodeIndex(idx);
  std::string tmp = path + ".tmp";
  {
    std::ofstream f(tmp, std::ios::binary);
    f.write(reinterpret_cast<const char*>(data.data()), static_cast<std::streamsize>(data.size()));
  }
  std::rename(tmp.c_str(), path.c_str());
}

}  // namespace tinygit
