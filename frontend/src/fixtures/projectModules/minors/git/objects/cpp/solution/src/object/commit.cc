#include "object/commit.h"
#include <sstream>
#include <stdexcept>

namespace tinygit {

std::vector<uint8_t> EncodeCommit(const Commit& c) {
  if (c.tree.IsZero()) throw std::runtime_error("object: commit missing tree");
  if (c.author.empty()) throw std::runtime_error("object: commit missing author");
  std::string committer = c.committer.empty() ? c.author : c.committer;
  std::ostringstream b;
  b << "tree " << c.tree.Hex() << "\n";
  for (const auto& p : c.parents) b << "parent " << p.Hex() << "\n";
  b << "author " << c.author << "\n";
  b << "committer " << committer << "\n";
  b << "\n";
  b << c.message;
  if (c.message.empty() || c.message.back() != '\n') b << "\n";
  std::string s = b.str();
  return std::vector<uint8_t>(s.begin(), s.end());
}

Commit DecodeCommit(const std::vector<uint8_t>& content) {
  Commit c;
  size_t i = 0;
  while (true) {
    if (i > content.size()) throw std::runtime_error("object: truncated commit");
    size_t nl = i;
    while (nl < content.size() && content[nl] != '\n') ++nl;
    if (nl >= content.size() && i < content.size())
      throw std::runtime_error("object: truncated commit");
    std::string line(reinterpret_cast<const char*>(&content[i]), nl - i);
    i = nl + 1;
    if (line.empty()) {
      if (i <= content.size())
        c.message.assign(reinterpret_cast<const char*>(&content[i]), content.size() - i);
      break;
    }
    auto sp = line.find(' ');
    if (sp == std::string::npos) throw std::runtime_error("object: bad commit header");
    std::string key = line.substr(0, sp);
    std::string val = line.substr(sp + 1);
    if (key == "tree") c.tree = ParseHex(val);
    else if (key == "parent") c.parents.push_back(ParseHex(val));
    else if (key == "author") c.author = val;
    else if (key == "committer") c.committer = val;
  }
  if (c.tree.IsZero()) throw std::runtime_error("object: commit missing tree");
  return c;
}

Hash PutCommit(Store s, const Commit& c) { return s.Put(kTypeCommit, EncodeCommit(c)); }

Commit GetCommit(Store s, const Hash& h) {
  auto pr = s.Get(h);
  if (pr.first != kTypeCommit) throw std::runtime_error(std::string("object: want commit got ") + pr.first);
  return DecodeCommit(pr.second);
}

}  // namespace tinygit
