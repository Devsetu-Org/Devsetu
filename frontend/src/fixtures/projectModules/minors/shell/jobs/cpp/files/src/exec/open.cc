#include "exec/open.h"
#include <fcntl.h>
#include <unistd.h>
#include <stdexcept>

namespace tinysh::exe {

void CloseAll(const std::vector<int>& files) {
  for (int fd : files) if (fd >= 0) close(fd);
}

int OpenOne(const std::string& dir, const ast::Redir& r) {
  std::string path = r.file;
  if (path.empty() || path[0] != '/') path = dir + "/" + path;
  int fd = -1;
  switch (r.kind) {
    case lex::kRedirOut:
    case lex::kRedirErr:
      fd = open(path.c_str(), O_CREAT | O_WRONLY | O_TRUNC, 0644);
      break;
    case lex::kRedirApp:
      fd = open(path.c_str(), O_CREAT | O_WRONLY | O_APPEND, 0644);
      break;
    case lex::kRedirIn:
      fd = open(path.c_str(), O_RDONLY);
      break;
    default:
      throw std::runtime_error("unknown redirect");
  }
  if (fd < 0) throw std::runtime_error("open failed");
  return fd;
}

std::vector<int> OpenRedirs(const std::string& dir, const std::vector<ast::Redir>& redirs) {
  std::vector<int> files;
  try {
    for (auto& r : redirs) files.push_back(OpenOne(dir, r));
    return files;
  } catch (...) {
    CloseAll(files);
    throw;
  }
}

}  // namespace tinysh::exe
