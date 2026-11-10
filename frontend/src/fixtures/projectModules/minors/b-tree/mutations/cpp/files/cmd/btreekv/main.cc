#include "db/db.h"

#include <iostream>
#include <sstream>
#include <string>

using namespace btreekv;

int main(int argc, char** argv) {
  std::string dir = "data";
  for (int i = 1; i < argc; ++i) {
    std::string a = argv[i];
    if (a == "--dir" && i + 1 < argc) dir = argv[++i];
  }
  DB d = DB::Open(dir);
  auto s = d.Stats();
  std::cout << "btreekv: dir=" << dir << ", " << s.keys << " keys, height " << s.height
            << ". Type 'help'.\n";
  std::string line;
  while (true) {
    std::cout << "> " << std::flush;
    if (!std::getline(std::cin, line)) {
      std::cout << "\n";
      break;
    }
    std::istringstream iss(line);
    std::string cmd;
    iss >> cmd;
    try {
      if (cmd == "put") {
        std::string key, value;
        iss >> key;
        std::getline(iss, value);
        if (!value.empty() && value[0] == ' ') value.erase(0, 1);
        d.Put(key, value);
        std::cout << "OK\n";
      } else if (cmd == "get") {
        std::string key, value;
        iss >> key;
        if (d.Get(key, &value)) std::cout << '"' << value << "\"\n";
        else std::cout << "(not found)\n";
      } else if (cmd == "stats") {
        s = d.Stats();
        std::cout << "keys=" << s.keys << " height=" << s.height << " leaves=" << s.leaves
                  << " internal=" << s.internal << " pages=" << s.pages << "\n";
      } else if (cmd == "quit" || cmd == "exit") {
        break;
      } else {
        std::cout << "commands: put get del scan stats quit\n";
      }
    } catch (const std::exception& e) {
      std::cout << "error: " << e.what() << "\n";
    }
  }
  d.Close();
  return 0;
}
