#include "ref/ref.h"
#include <fstream>
#include <stdexcept>
#include <sys/stat.h>

namespace tinygit {
namespace {
void MkDirAll(const std::string& path) {
  size_t pos = 0;
  while (true) {
    pos = path.find('/', pos + 1);
    std::string sub = (pos == std::string::npos) ? path : path.substr(0, pos);
    if (!sub.empty()) ::mkdir(sub.c_str(), 0755);
    if (pos == std::string::npos) break;
  }
}
std::string DirName(const std::string& path) {
  auto p = path.rfind('/');
  return p == std::string::npos ? "." : path.substr(0, p);
}
std::string Trim(std::string s) {
  while (!s.empty() && (s.back() == '\n' || s.back() == '\r' || s.back() == ' ')) s.pop_back();
  size_t i = 0;
  while (i < s.size() && (s[i] == ' ' || s[i] == '\t')) ++i;
  return s.substr(i);
}
}  // namespace

std::string SafePath(const Repo& r, const std::string& name) {
  std::string n = name;
  while (!n.empty() && n.front() == '/') n.erase(n.begin());
  if (n.empty() || n.find("..") != std::string::npos)
    throw std::runtime_error("ref: bad name");
  return r.GitDir() + "/" + n;
}

Hash ReadRef(const Repo& r, const std::string& name) {
  // TODO(2.1): ReadRef
  throw std::runtime_error("TODO(2.1): ReadRef");
}

void WriteRef(const Repo& r, const std::string& name, const Hash& h) {
  // TODO(2.1): WriteRef
  throw std::runtime_error("TODO(2.1): WriteRef");
}

}  // namespace tinygit
