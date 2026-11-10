#include "object/header.h"
#include <algorithm>
#include <stdexcept>

namespace tinygit {

std::vector<uint8_t> EncodeHeader(const std::string& typ, const std::vector<uint8_t>& content) {
  std::string hdr = typ + " " + std::to_string(content.size());
  hdr.push_back('\0');
  std::vector<uint8_t> out;
  out.reserve(hdr.size() + content.size());
  out.insert(out.end(), hdr.begin(), hdr.end());
  out.insert(out.end(), content.begin(), content.end());
  return out;
}

std::pair<std::string, std::vector<uint8_t>> SplitHeader(const std::vector<uint8_t>& data) {
  auto nul = std::find(data.begin(), data.end(), 0);
  if (nul == data.end()) throw std::runtime_error("object: missing header NUL");
  auto space = std::find(data.begin(), nul, ' ');
  if (space == nul) throw std::runtime_error("object: missing type/size space");
  std::string typ(data.begin(), space);
  std::string size_str(space + 1, nul);
  int size = std::stoi(size_str);
  std::vector<uint8_t> content(nul + 1, data.end());
  if (static_cast<int>(content.size()) != size)
    throw std::runtime_error("object: size mismatch");
  return {typ, content};
}

}  // namespace tinygit
