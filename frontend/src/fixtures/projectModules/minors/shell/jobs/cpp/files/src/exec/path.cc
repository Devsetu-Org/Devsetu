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
  if (name.empty()) throw NotFound();
  if (name.find('/') != std::string::npos) {
    std::string path = name;
    if (name[0] != '/') path = dir + "/" + name;
    return CheckExec(path);
  }
  std::string path_env = EnvGet(env, "PATH");
  size_t start = 0;
  while (start <= path_env.size()) {
    size_t end = path_env.find(':', start);
    if (end == std::string::npos) end = path_env.size();
    std::string d = path_env.substr(start, end - start);
    if (d.empty()) d = ".";
    try {
      return CheckExec(d + "/" + name);
    } catch (...) {
    }
    if (end == path_env.size()) break;
    start = end + 1;
  }
  throw NotFound();
}

}  // namespace tinysh::exe
