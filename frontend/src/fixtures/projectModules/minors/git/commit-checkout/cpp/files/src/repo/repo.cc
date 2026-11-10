#include "repo/repo.h"
#include <sys/stat.h>
#include <cstdlib>
#include <fstream>
#include <stdexcept>

namespace tinygit {
namespace {

std::string AbsPath(const std::string& path) {
  char* resolved = realpath(path.c_str(), nullptr);
  if (!resolved) {
    // may not exist yet for Init
    return path;
  }
  std::string out(resolved);
  free(resolved);
  return out;
}

bool IsDir(const std::string& path) {
  struct stat st;
  return ::stat(path.c_str(), &st) == 0 && S_ISDIR(st.st_mode);
}

void MkDirAll(const std::string& path) {
  size_t pos = 0;
  while (true) {
    pos = path.find('/', pos + 1);
    std::string sub = (pos == std::string::npos) ? path : path.substr(0, pos);
    if (!sub.empty()) ::mkdir(sub.c_str(), 0755);
    if (pos == std::string::npos) break;
  }
}

}  // namespace

Repo Init(const std::string& root) {
  std::string abs = AbsPath(root);
  if (abs == root) {
    // try create then resolve
    ::mkdir(root.c_str(), 0755);
    abs = AbsPath(root);
  }
  std::string git = abs + "/" + kDirName;
  MkDirAll(git + "/objects");
  MkDirAll(git + "/refs/heads");
  std::string head = git + "/HEAD";
  struct stat st;
  if (::stat(head.c_str(), &st) != 0) {
    std::ofstream f(head);
    f << "ref: refs/heads/main\n";
  }
  return Repo(abs);
}

Repo Open(const std::string& path) {
  std::string abs = AbsPath(path);
  std::string cur = abs;
  while (true) {
    if (IsDir(cur + "/" + kDirName)) return Repo(cur);
    auto p = cur.rfind('/');
    if (p == std::string::npos || cur == "/") throw std::runtime_error("repo: not a tinygit repository");
    if (p == 0) cur = "/";
    else cur = cur.substr(0, p);
    if (cur.empty()) throw std::runtime_error("repo: not a tinygit repository");
  }
}

}  // namespace tinygit
