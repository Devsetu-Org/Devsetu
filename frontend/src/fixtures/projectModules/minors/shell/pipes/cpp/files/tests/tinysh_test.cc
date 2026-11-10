#include "check.h"
#include "lex/lex.h"
#include "parse/parse.h"
#include "exec/shell.h"
#include <fcntl.h>
#include <unistd.h>
#include <sys/stat.h>
#include <fstream>
#include <sstream>
#include <cstring>
#include <cstdlib>

using namespace tinysh;

struct RunResult {
  std::string stdout_s;
  std::string stderr_s;
  int status;
};

static std::string ReadFd(int fd) {
  std::string out;
  char buf[4096];
  for (;;) {
    ssize_t n = read(fd, buf, sizeof(buf));
    if (n <= 0) break;
    out.append(buf, buf + n);
  }
  return out;
}

static RunResult RunLines(const std::string& dir, std::initializer_list<const char*> lines) {
  int outp[2], errp[2];
  pipe(outp);
  pipe(errp);
  exe::Shell sh = exe::New();
  sh.dir = dir;
  sh.stdout_fd = outp[1];
  sh.stderr_fd = errp[1];
  sh.use_capture = true;
  sh.capture_err = new std::string();
  int status = 0;
  for (auto line : lines) {
    status = sh.RunLine(line);
    if (sh.Exited()) {
      status = sh.LastStatus();
      break;
    }
  }
  close(outp[1]);
  close(errp[1]);
  RunResult r;
  r.stdout_s = ReadFd(outp[0]);
  close(outp[0]);
  close(errp[0]);
  r.stderr_s = *sh.capture_err;
  delete sh.capture_err;
  r.status = status;
  return r;
}

static std::string TmpDir() {
  char tmpl[] = "/tmp/tinyshXXXXXX";
  char* p = mkdtemp(tmpl);
  return p ? std::string(p) : "/tmp";
}

TEST(WordsAndQuotes) {
  auto toks = lex::Scan("echo 'hello world' \"hi there\"");
  CHECK_EQ(toks.size(), 4u);
  CHECK_EQ(toks[0].kind, lex::kWord);
  CHECK_EQ(toks[0].lit, std::string("echo"));
  CHECK_EQ(toks[1].lit, std::string("hello world"));
  CHECK_EQ(toks[2].lit, std::string("hi there"));
}

TEST(Escapes) {
  auto toks = lex::Scan("echo hello\\ world \"a\\\"b\" \\>");
  CHECK_EQ(toks[1].lit, std::string("hello world"));
  CHECK_EQ(toks[2].lit, std::string("a\"b"));
  CHECK_EQ(toks[3].kind, lex::kWord);
  CHECK_EQ(toks[3].lit, std::string(">"));
}

TEST(Operators) {
  auto toks = lex::Scan("a | b > out >> log < in 2> err &");
  CHECK_EQ(toks[1].kind, lex::kPipe);
  CHECK_EQ(toks[3].kind, lex::kRedirOut);
  CHECK_EQ(toks[5].kind, lex::kRedirApp);
  CHECK_EQ(toks[7].kind, lex::kRedirIn);
  CHECK_EQ(toks[9].kind, lex::kRedirErr);
  CHECK_EQ(toks[11].kind, lex::kAmp);
}

TEST(Unterminated) {
  bool threw = false;
  try { lex::Scan("echo 'abc"); } catch (...) { threw = true; }
  CHECK(threw);
}

TEST(ParseSimple) {
  auto pl = parse::Parse(lex::Scan("echo hello"));
  CHECK_EQ(pl.cmds.size(), 1u);
  CHECK_EQ(pl.cmds[0].argv[0], std::string("echo"));
}

TEST(ParseRedirects) {
  auto pl = parse::Parse(lex::Scan("echo hi > out 2> err < in"));
  CHECK_EQ(pl.cmds[0].redirs.size(), 3u);
  CHECK_EQ(pl.cmds[0].redirs[0].kind, lex::kRedirOut);
}

TEST(ParsePipeline) {
  auto pl = parse::Parse(lex::Scan("echo a | tr a-z A-Z | cat"));
  CHECK_EQ(pl.cmds.size(), 3u);
}

TEST(Echo) {
  auto d = TmpDir();
  auto r = RunLines(d, {"echo hello"});
  CHECK_EQ(r.status, 0);
  CHECK_EQ(r.stdout_s, std::string("hello\n"));
  rmdir(d.c_str());
}

TEST(ExitStatus) {
  auto d = TmpDir();
  auto r = RunLines(d, {"false"});
  CHECK(r.status != 0);
  r = RunLines(d, {"true"});
  CHECK_EQ(r.status, 0);
  rmdir(d.c_str());
}

TEST(Cd) {
  auto d = TmpDir();
  std::string sub = d + "/sub";
  mkdir(sub.c_str(), 0755);
  auto r = RunLines(d, {"cd sub", "pwd"});
  CHECK_EQ(r.status, 0);
  // realpath compare
  char *a = realpath(r.stdout_s.c_str(), nullptr);
  // strip newline
  std::string got = r.stdout_s;
  while (!got.empty() && got.back() == '\n') got.pop_back();
  char *b = realpath(sub.c_str(), nullptr);
  CHECK_EQ(std::string(got), std::string(b ? b : ""));
  free(a); free(b);
  rmdir(sub.c_str());
  rmdir(d.c_str());
}

TEST(ExitBuiltin) {
  auto d = TmpDir();
  auto r = RunLines(d, {"exit 7"});
  CHECK_EQ(r.status, 7);
  rmdir(d.c_str());
}

TEST(RedirectOut) {
  auto d = TmpDir();
  auto r = RunLines(d, {"echo hello > out.txt"});
  CHECK_EQ(r.status, 0);
  std::ifstream in(d + "/out.txt");
  std::stringstream ss; ss << in.rdbuf();
  CHECK_EQ(ss.str(), std::string("hello\n"));
  unlink((d + "/out.txt").c_str());
  rmdir(d.c_str());
}

TEST(RedirectAppend) {
  auto d = TmpDir();
  auto r = RunLines(d, {"echo a > out.txt", "echo b >> out.txt"});
  CHECK_EQ(r.status, 0);
  std::ifstream in(d + "/out.txt");
  std::stringstream ss; ss << in.rdbuf();
  CHECK_EQ(ss.str(), std::string("a\nb\n"));
  unlink((d + "/out.txt").c_str());
  rmdir(d.c_str());
}

TEST(RedirectIn) {
  auto d = TmpDir();
  {
    std::ofstream out(d + "/in.txt");
    out << "xyz\n";
  }
  auto r = RunLines(d, {"cat < in.txt"});
  CHECK_EQ(r.status, 0);
  CHECK_EQ(r.stdout_s, std::string("xyz\n"));
  unlink((d + "/in.txt").c_str());
  rmdir(d.c_str());
}

TEST(RedirectErr) {
  auto d = TmpDir();
  auto r = RunLines(d, {"sh -c 'echo oops 1>&2' 2> err.txt"});
  CHECK_EQ(r.status, 0);
  std::ifstream in(d + "/err.txt");
  std::stringstream ss; ss << in.rdbuf();
  CHECK_EQ(ss.str(), std::string("oops\n"));
  unlink((d + "/err.txt").c_str());
  rmdir(d.c_str());
}

TEST(Pipe) {
  auto d = TmpDir();
  auto r = RunLines(d, {"printf 'abc\\n' | tr a-z A-Z"});
  CHECK_EQ(r.status, 0);
  CHECK_EQ(r.stdout_s, std::string("ABC\n"));
  rmdir(d.c_str());
}

TEST(PipeStatus) {
  auto d = TmpDir();
  auto r = RunLines(d, {"true | false"});
  CHECK(r.status != 0);
  r = RunLines(d, {"false | true"});
  CHECK_EQ(r.status, 0);
  rmdir(d.c_str());
}

TEST(QuotesInArgv) {
  auto d = TmpDir();
  auto r = RunLines(d, {"echo 'a b'"});
  CHECK_EQ(r.status, 0);
  CHECK_EQ(r.stdout_s, std::string("a b\n"));
  rmdir(d.c_str());
}

TEST(CommandNotFound) {
  auto d = TmpDir();
  auto r = RunLines(d, {"definitely-not-a-real-command-xyz"});
  CHECK(r.status != 0);
  CHECK(r.stderr_s.find("not found") != std::string::npos ||
        r.stderr_s.find("definitely-not") != std::string::npos);
  rmdir(d.c_str());
}

int main() { return check::RunAll(); }
