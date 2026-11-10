#include "analyze/analyze.h"
#include "postings/map.h"
#include "postings/segment.h"

#include <cstdint>
#include <iostream>
#include <string>
#include <unordered_map>
#include <vector>

int main() {
  findx::postings::Map m;
  uint32_t doc_id = 0;
  std::cerr << "findx postings. One document per line. Ctrl-D to encode.\n";
  std::string line;
  while (std::getline(std::cin, line)) {
    std::unordered_map<std::string, uint32_t> tf;
    for (const auto& t : findx::analyze::Analyze(line)) ++tf[t];
    for (const auto& kv : tf) m.Add(kv.first, doc_id, kv.second);
    ++doc_id;
  }
  std::vector<uint8_t> buf;
  findx::postings::WriteSegment(&buf, m);
  std::cout.write(reinterpret_cast<const char*>(buf.data()), static_cast<std::streamsize>(buf.size()));
  return 0;
}
