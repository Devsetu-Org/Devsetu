// REPL over the store as it grows. From chapter 2 on it keeps its data in a
// directory, so quitting (or killing it) loses nothing.

#include <iostream>
#include <sstream>
#include <string>
#include <vector>

#include "db/db.h"

namespace {

const char* kHelp = R"(commands:
  put <key> <value>   store a value
  get <key>           look a key up
  del <key>           delete a key
  stats               memtable and log size
  quit)";

}  // namespace

int main(int argc, char** argv) {
  std::string dir = "data";
  for (int i = 1; i + 1 < argc; ++i) {
    if (std::string(argv[i]) == "--dir") dir = argv[++i];
  }

  auto d = lsmkv::db::Open(dir);
  auto s = d->GetStats();
  std::cout << "lsmkv: memtable + write-ahead log (chapter 2). dir=" << dir
            << ", recovered " << s.memtable_entries << " entries. Type 'help'.\n";

  std::string line;
  while (true) {
    std::cout << "> " << std::flush;
    if (!std::getline(std::cin, line)) {
      std::cout << "\n";
      break;
    }
    std::istringstream in(line);
    std::vector<std::string> args;
    for (std::string word; in >> word;) args.push_back(word);
    if (args.empty()) continue;
    const std::string cmd = args[0];
    args.erase(args.begin());

    try {
      if (cmd == "put" && args.size() >= 2) {
        std::string value = args[1];
        for (size_t i = 2; i < args.size(); ++i) value += " " + args[i];
        d->Put(args[0], value);
        std::cout << "OK\n";
      } else if (cmd == "get" && args.size() == 1) {
        std::string value;
        if (d->Get(args[0], &value)) {
          std::cout << '"' << value << "\"\n";
        } else {
          std::cout << "(not found)\n";
        }
      } else if (cmd == "del" && args.size() == 1) {
        d->Delete(args[0]);
        std::cout << "OK\n";
      } else if (cmd == "stats") {
        s = d->GetStats();
        std::cout << "memtable entries=" << s.memtable_entries << " bytes=" << s.memtable_bytes
                  << "  wal bytes=" << s.wal_bytes << "\n";
      } else if (cmd == "quit" || cmd == "exit") {
        break;
      } else {
        std::cout << kHelp << "\n";
      }
    } catch (const std::exception& e) {
      std::cout << "error: " << e.what() << "\n";
    }
  }
  d->Close();
  return 0;
}
