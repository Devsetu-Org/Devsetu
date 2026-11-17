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
  std::sort(idx.entries.begin(), idx.entries.end(),
            [](const IndexEntry& a, const IndexEntry& b) { return a.path < b.path; });
  std::ostringstream b;
  b << "TINYIDX 1\n";
  for (const auto& e : idx.entries) {
    if (e.path.empty() || e.path.find('\n') != std::string::npos || e.path.find('\t') != std::string::npos)
      throw std::runtime_error("index: bad path");
    b << e.path << "\t" << e.mode << "\t" << e.hash.Hex() << "\n";
  }
  std::string s = b.str();
  return std::vector<uint8_t>(s.begin(), s.end());
}

Index DecodeIndex(const std::vector<uint8_t>& data) {
  std::string text(data.begin(), data.end());
  std::istringstream in(text);
  std::string header;
  if (!std::getline(in, header)) throw std::runtime_error("index: empty");
  if (header.rfind("TINYIDX ", 0) != 0) throw std::runtime_error("index: bad header");
  Index idx;
  std::string line;
  while (std::getline(in, line)) {
    if (line.empty()) continue;
    auto t1 = line.find('\t');
    auto t2 = line.find('\t', t1 == std::string::npos ? 0 : t1 + 1);
    if (t1 == std::string::npos || t2 == std::string::npos) throw std::runtime_error("index: bad line");
    IndexEntry e;
    e.path = line.substr(0, t1);
    e.mode = line.substr(t1 + 1, t2 - t1 - 1);
    e.hash = ParseHex(line.substr(t2 + 1));
    idx.entries.push_back(e);
  }
  return idx;
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
