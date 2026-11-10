#include "findx/findx.h"

#include <cstdlib>
#include <iostream>
#include <sstream>
#include <string>

int main() {
  const char* env = std::getenv("FINDX_DIR");
  std::string dir = env ? env : "./findx-data";
  auto idx = findx::Open(dir);
  std::cerr << "findx. dir=" << dir << "  commands: add <id> <text> | flush\n";
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
    } else {
      std::cerr << "unknown command\n";
    }
  }
}
