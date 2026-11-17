#pragma once
#include <string>
#include <utility>
#include <vector>

namespace tinygit {

std::vector<uint8_t> EncodeHeader(const std::string& typ, const std::vector<uint8_t>& content);
std::pair<std::string, std::vector<uint8_t>> SplitHeader(const std::vector<uint8_t>& data);

}  // namespace tinygit
