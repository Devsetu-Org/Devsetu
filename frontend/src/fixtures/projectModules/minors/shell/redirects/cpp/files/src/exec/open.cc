#include "exec/open.h"
#include <fcntl.h>
#include <unistd.h>
#include <stdexcept>

namespace tinysh::exe {

void CloseAll(const std::vector<int>& files) {
  for (int fd : files) if (fd >= 0) close(fd);
}

int OpenOne(const std::string& dir, const ast::Redir& r) {
  // TODO(3.2): Resolve r.file against dir. Open with trunc/append/read per Kind.
  (void)dir; (void)r;
  throw std::runtime_error("TODO(3.2): OpenOne");
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
