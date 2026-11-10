#include "ref/head.h"
#include "ref/ref.h"
#include <fstream>
#include <stdexcept>

namespace tinygit {
namespace {
std::string Trim(std::string s) {
  while (!s.empty() && (s.back() == '\n' || s.back() == '\r' || s.back() == ' ')) s.pop_back();
  return s;
}
}  // namespace

HEAD ReadHEAD(const Repo& r) {
  std::ifstream f(r.GitDir() + "/HEAD");
  if (!f) throw std::runtime_error("ref: missing HEAD");
  std::string s((std::istreambuf_iterator<char>(f)), {});
  s = Trim(s);
  if (s.rfind("ref: ", 0) == 0) {
    HEAD h;
    h.symbolic = Trim(s.substr(5));
    return h;
  }
  HEAD h;
  h.hash = ParseHex(s);
  return h;
}

Hash ResolveHEAD(const Repo& r) {
  HEAD h = ReadHEAD(r);
  if (!h.symbolic.empty()) return ReadRef(r, h.symbolic);
  return h.hash;
}

void WriteSymbolicHEAD(const Repo& r, const std::string& name) {
  std::string n = name;
  while (!n.empty() && n.front() == '/') n.erase(n.begin());
  if (n.empty() || n.find("..") != std::string::npos)
    throw std::runtime_error("ref: bad HEAD target");
  std::ofstream f(r.GitDir() + "/HEAD");
  f << "ref: " << n << "\n";
}

void WriteDetachedHEAD(const Repo& r, const Hash& h) {
  std::ofstream f(r.GitDir() + "/HEAD");
  f << h.Hex() << "\n";
}

}  // namespace tinygit
