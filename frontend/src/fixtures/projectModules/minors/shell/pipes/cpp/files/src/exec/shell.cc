#include "exec/shell.h"
#include "exec/pipe.h"
#include "lex/lex.h"
#include "parse/parse.h"
#include <cstdarg>
#include <cstdio>
#include <unistd.h>
#include <cstring>

extern char** environ;

namespace tinysh::exe {

bool Shell::Exited() {
  std::lock_guard<std::mutex> lock(*mu);
  return exited_;
}

int Shell::LastStatus() {
  std::lock_guard<std::mutex> lock(*mu);
  return status_;
}

void Shell::SetExit(int code) {
  std::lock_guard<std::mutex> lock(*mu);
  exited_ = true;
  status_ = code;
}

void Shell::PrintfErr(const char* fmt, ...) {
  char buf[1024];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(buf, sizeof(buf), fmt, ap);
  va_end(ap);
  if (use_capture && capture_err) {
    *capture_err += buf;
  } else {
    (void)!write(stderr_fd, buf, strlen(buf));
  }
}

static std::string Trim(std::string s) {
  while (!s.empty() && (s.back() == '\n' || s.back() == '\r' || s.back() == ' ' || s.back() == '\t'))
    s.pop_back();
  size_t i = 0;
  while (i < s.size() && (s[i] == ' ' || s[i] == '\t')) i++;
  return s.substr(i);
}

int Shell::RunLine(const std::string& line_in) {
  std::string line = Trim(line_in);
  if (line.empty() || line[0] == '#') return 0;
  try {
    auto toks = lex::Scan(line);
    auto pl = parse::Parse(toks);
    return RunPipeline(*this, pl);
  } catch (const lex::Error& e) {
    PrintfErr("lex: %s\n", e.what());
    return 2;
  } catch (const parse::Error& e) {
    PrintfErr("parse: %s\n", e.what());
    return 2;
  } catch (const std::exception& e) {
    PrintfErr("%s\n", e.what());
    return 127;
  }
}

Shell New() {
  Shell s;
  char cwd[4096];
  if (getcwd(cwd, sizeof(cwd))) s.dir = cwd;
  else s.dir = ".";
  for (char** e = environ; *e; ++e) s.env.push_back(*e);
  return s;
}

}  // namespace tinysh::exe
