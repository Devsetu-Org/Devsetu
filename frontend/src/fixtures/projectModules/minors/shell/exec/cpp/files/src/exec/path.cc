#include <stdexcept>
#include "exec/path.h"
#include <sys/stat.h>
#include <unistd.h>

namespace tinysh::exe {

static std::string CheckExec(const std::string& path) {
  struct stat st {};
  if (stat(path.c_str(), &st) != 0) throw NotFound();
  if (S_ISDIR(st.st_mode)) throw NotFound();
  if ((st.st_mode & 0111) == 0) throw NotFound();
  return path;
}

std::string EnvGet(const std::vector<std::string>& env, const std::string& key) {
  std::string prefix = key + "=";
  for (int i = static_cast<int>(env.size()) - 1; i >= 0; --i) {
    if (env[i].compare(0, prefix.size(), prefix) == 0)
      return env[i].substr(prefix.size());
  }
  return "";
}

std::string LookPath(const std::string& name, const std::string& dir,
                     const std::vector<std::string>& env) {
  // TODO(2.1): If name contains '/', resolve against dir when relative and CheckExec.
  // Otherwise split PATH from env and try each directory.
  (void)name; (void)dir; (void)env; (void)CheckExec;
  throw std::runtime_error("TODO(2.1): LookPath");
}

}  // namespace tinysh::exe
