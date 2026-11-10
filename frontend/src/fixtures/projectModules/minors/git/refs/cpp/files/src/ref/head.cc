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
  // TODO(2.2): ReadHEAD
  throw std::runtime_error("TODO(2.2): ReadHEAD");
}

Hash ResolveHEAD(const Repo& r) {
  // TODO(2.2): ResolveHEAD
  throw std::runtime_error("TODO(2.2): ResolveHEAD");
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
