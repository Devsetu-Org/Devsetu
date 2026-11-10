#include "analyze/analyze.h"
#include "findx/findx.h"

#include <cstdlib>
#include <iostream>
#include <sstream>
#include <string>

int main(int argc, char** argv) {
  if (argc > 1 && std::string(argv[1]) == "analyze") {
    std::string line;
    while (std::getline(std::cin, line)) {
      auto toks = findx::analyze::Analyze(line);
      for (size_t i = 0; i < toks.size(); ++i) {
        if (i) std::cout << ' ';
        std::cout << toks[i];
      }
      std::cout << '\n';
    }
    return 0;
  }

  const char* env = std::getenv("FINDX_DIR");
  std::string dir = env ? env : "./findx-data";
  auto idx = findx::Open(dir);
  std::cerr << "findx. dir=" << dir << "  commands: add <id> <text> | flush | search <k> <query>\n";
  std::string line;
  while (true) {
    std::cerr << "findx> ";
    if (!std::getline(std::cin, line)) return 0;
    if (line.empty()) continue;
    std::istringstream in(line);
    std::string cmd;
    in >> cmd;
    if (cmd == "add") {
      std::string id, text;
      in >> id;
      std::getline(in, text);
      if (!text.empty() && text[0] == ' ') text.erase(0, 1);
      if (id.empty() || text.empty()) {
        std::cerr << "usage: add <id> <text>\n";
        continue;
      }
      try {
        idx.Add(id, text);
      } catch (const std::exception& e) {
        std::cerr << e.what() << "\n";
      }
    } else if (cmd == "flush") {
      try {
        idx.Flush();
      } catch (const std::exception& e) {
        std::cerr << e.what() << "\n";
      }
    } else if (cmd == "search") {
      int k = 0;
      in >> k;
      std::string q;
      std::getline(in, q);
      if (!q.empty() && q[0] == ' ') q.erase(0, 1);
      if (q.empty()) {
        std::cerr << "usage: search <k> <query>\n";
        continue;
      }
      try {
        auto hits = idx.Search(q, k);
        for (const auto& h : hits) {
          std::cout.setf(std::ios::fixed);
          std::cout.precision(6);
          std::cout << h.id << '\t' << h.score << '\n';
        }
      } catch (const std::exception& e) {
        std::cerr << e.what() << "\n";
      }
    } else {
      std::cerr << "unknown command\n";
    }
  }
}
