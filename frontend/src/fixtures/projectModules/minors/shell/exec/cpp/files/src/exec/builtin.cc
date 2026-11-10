#include "exec/builtin.h"
#include "exec/path.h"
#include "exec/jobs.h"
#include <sys/stat.h>
#include <stdexcept>

namespace tinysh::exe {

bool IsBuiltin(const std::string& name) {
  return name == "cd" || name == "exit" || name == "wait";
}

std::pair<int, bool> RunBuiltin(Shell& s, const std::vector<std::string>& argv) {
  if (argv.empty()) return {0, false};
  if (argv[0] == "cd") return {BuiltinCd(s, {argv.begin() + 1, argv.end()}), true};
  if (argv[0] == "exit") return {BuiltinExit(s, {argv.begin() + 1, argv.end()}), true};
  if (argv[0] == "wait") return {BuiltinWait(s, {argv.begin() + 1, argv.end()}), true};
  return {0, false};
}

int BuiltinCd(Shell& s, const std::vector<std::string>& args) {
  // TODO(2.3): Resolve the directory (HOME when no args), Stat it, set s.dir.
  (void)s; (void)args;
  throw std::runtime_error("TODO(2.3): BuiltinCd");
}

int BuiltinExit(Shell& s, const std::vector<std::string>& args) {
  // TODO(2.3): Parse an optional numeric code, call SetExit, return the code.
  (void)s; (void)args;
  throw std::runtime_error("TODO(2.3): BuiltinExit");
}

}  // namespace tinysh::exe
