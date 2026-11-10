#include "diff/diff.h"
#include "diff/log.h"
#include "index/add.h"
#include "index/status.h"
#include "merge/merge.h"
#include "object/blob.h"
#include "object/hash.h"
#include "ref/head.h"
#include "ref/update.h"
#include "repo/repo.h"
#include "worktree/checkout.h"
#include "worktree/commit.h"
#include "worktree/write_tree.h"

#include <fstream>
#include <iostream>
#include <string>
#include <vector>

using namespace tinygit;

static void Usage() {
  std::cerr << "tinygit <command>\n"
            << "  init | hash-object | cat-file | update-ref | add | status\n"
            << "  write-tree | commit | checkout | log | diff | merge\n";
}

static std::vector<uint8_t> ReadFile(const std::string& path) {
  std::ifstream f(path, std::ios::binary);
  return std::vector<uint8_t>((std::istreambuf_iterator<char>(f)), {});
}

static int Run(const std::string& cmd, const std::vector<std::string>& args) {
  if (cmd == "init") {
    std::string root = args.empty() ? "." : args[0];
    auto r = Init(root);
    std::cout << "initialized " << r.GitDir() << "\n";
    return 0;
  }
  if (cmd == "hash-object") {
    if (args.empty()) throw std::runtime_error("hash-object <file>");
    auto r = Open(".");
    auto s = r.Objects();
    std::cout << PutBlob(s, ReadFile(args[0])).Hex() << "\n";
    return 0;
  }
  if (cmd == "cat-file") {
    if (args.size() < 2) throw std::runtime_error("cat-file -t|-p <hash>");
    auto r = Open(".");
    auto s = r.Objects();
    auto pr = s.Get(ParseHex(args[1]));
    if (args[0] == "-t") { std::cout << pr.first << "\n"; return 0; }
    std::cout.write(reinterpret_cast<const char*>(pr.second.data()), pr.second.size());
    return 0;
  }
  if (cmd == "update-ref") {
    if (args.size() < 2) throw std::runtime_error("update-ref <name> <hash>");
    UpdateRef(Open("."), args[0], ParseHex(args[1]), kZero);
    return 0;
  }
  if (cmd == "add") {
    if (args.empty()) throw std::runtime_error("add <path>");
    Add(Open("."), args[0]);
    return 0;
  }
  if (cmd == "status") {
    auto st = Status(Open("."));
    auto print = [](const char* t, const std::vector<std::string>& v) {
      if (v.empty()) return;
      std::cout << t << ":\n";
      for (const auto& p : v) std::cout << "   " << p << "\n";
    };
    print("Staged", st.staged);
    print("Modified", st.modified);
    print("Untracked", st.untracked);
    return 0;
  }
  if (cmd == "write-tree") {
    std::cout << WriteTree(Open(".")).Hex() << "\n";
    return 0;
  }
  if (cmd == "commit") {
    std::string msg;
    for (size_t i = 0; i + 1 < args.size(); ++i)
      if (args[i] == "-m") msg = args[i + 1];
    std::cout << CommitWorktree(Open("."), CommitOpts{msg, ""}).Hex() << "\n";
    return 0;
  }
  if (cmd == "checkout") {
    if (args.empty()) throw std::runtime_error("checkout <branch|hash>");
    auto r = Open(".");
    try {
      Checkout(r, ParseHex(args[0]));
    } catch (...) {
      CheckoutBranch(r, args[0]);
    }
    return 0;
  }
  if (cmd == "log") {
    auto r = Open(".");
    auto s = r.Objects();
    auto tip = ResolveHEAD(r);
    auto [commits, hashes] = LogWalk(s, tip);
    for (size_t i = 0; i < commits.size(); ++i) {
      std::cout << "commit " << hashes[i].Hex() << "\n";
      std::cout << "Author: " << commits[i].author << "\n\n";
      std::cout << "    " << commits[i].message;
      if (commits[i].message.empty() || commits[i].message.back() != '\n') std::cout << "\n";
    }
    return 0;
  }
  if (cmd == "diff") {
    if (args.size() < 2) throw std::runtime_error("diff <tree-a> <tree-b>");
    auto s = Open(".").Objects();
    for (const auto& ch : TreeDiff(s, ParseHex(args[0]), ParseHex(args[1])))
      std::cout << ch.status << "\t" << ch.path << "\n";
    return 0;
  }
  if (cmd == "merge") {
    if (args.empty()) throw std::runtime_error("merge <branch>");
    auto res = Merge(Open("."), args[0]);
    if (res.fast_forward) std::cout << "fast-forward " << res.commit.Hex() << "\n";
    else std::cout << res.commit.Hex() << "\n";
    return 0;
  }
  Usage();
  throw std::runtime_error("unknown command");
}

int main(int argc, char** argv) {
  if (argc < 2) { Usage(); return 2; }
  try {
    std::vector<std::string> args;
    for (int i = 2; i < argc; ++i) args.push_back(argv[i]);
    return Run(argv[1], args);
  } catch (const std::exception& e) {
    std::cerr << e.what() << "\n";
    return 1;
  }
}
