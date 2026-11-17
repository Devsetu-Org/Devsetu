#include "exec/builtin.h"
#include "exec/path.h"
#include "exec/jobs.h"
#include <sys/stat.h>

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
  std::string directory;
  if (args.empty()) {
    directory = EnvGet(s.env, "HOME");
    if (directory.empty()) {
      s.PrintfErr("cd: HOME not set\n");
      return 1;
    }
  } else if (args.size() == 1) {
    directory = args[0];
  } else {
    s.PrintfErr("cd: too many arguments\n");
    return 1;
  }
  if (directory.empty() || directory[0] != '/') directory = s.dir + "/" + directory;
  struct stat st {};
  if (stat(directory.c_str(), &st) != 0 || !S_ISDIR(st.st_mode)) {
    std::string name = args.size() == 1 ? args[0] : directory;
    s.PrintfErr("cd: %s: no such directory\n", name.c_str());
    return 1;
  }
  s.dir = directory;
  return 0;
}

int BuiltinExit(Shell& s, const std::vector<std::string>& args) {
  int code = 0;
  if (!args.empty()) {
    try {
      code = std::stoi(args[0]);
    } catch (...) {
      s.PrintfErr("exit: numeric argument required\n");
      s.SetExit(2);
      return 2;
    }
  }
  s.SetExit(code);
  return code;
}

}  // namespace tinysh::exe
