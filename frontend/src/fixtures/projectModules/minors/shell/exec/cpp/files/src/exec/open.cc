#include "exec/open.h"
#include <stdexcept>
#include <unistd.h>
namespace tinysh::exe {
void CloseAll(const std::vector<int>& files) {
  for (int fd : files) if (fd >= 0) ::close(fd);
}
int OpenOne(const std::string& dir, const ast::Redir& r) {
  (void)dir; (void)r; throw std::runtime_error("redirects not supported yet");
}
std::vector<int> OpenRedirs(const std::string& dir, const std::vector<ast::Redir>& redirs) {
  (void)dir;
  if (redirs.empty()) return {};
  throw std::runtime_error("redirects not supported yet");
}
}
