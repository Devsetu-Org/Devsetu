#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include "db/db.h"
int main(int argc, char** argv) {
  std::string dir = "data";
  for (int i = 1; i + 1 < argc; ++i)
    if (std::string(argv[i]) == "--dir") dir = argv[++i];
  auto d = lsmkv::db::Open(dir);
  auto s = d->GetStats();
  std::cout << "lsmkv: memtable, log, and SSTables (chapter 3). dir=" << dir
            << ", " << s.tables << " tables, recovered " << s.memtable_entries
            << " log entries. Type 'help'.\n";
  const char* help = "commands:\n  put <key> <value>\n  get <key>\n  del <key>\n  flush\n  stats\n  quit";
  std::string line;
  while (true) {
    std::cout << "> " << std::flush;
    if (!std::getline(std::cin, line)) { std::cout << "\n"; break; }
    std::istringstream in(line);
    std::vector<std::string> args;
    for (std::string w; in >> w;) args.push_back(w);
    if (args.empty()) continue;
    std::string cmd = args[0]; args.erase(args.begin());
    try {
      if (cmd == "put" && args.size() >= 2) {
        std::string v = args[1]; for (size_t i=2;i<args.size();++i) v += " "+args[i];
        d->Put(args[0], v); std::cout << "OK\n";
      } else if (cmd == "get" && args.size()==1) {
        std::string v; if (d->Get(args[0], &v)) std::cout << '"' << v << "\"\n"; else std::cout << "(not found)\n";
      } else if (cmd == "del" && args.size()==1) {
        d->Delete(args[0]); std::cout << "OK\n";
      } else if (cmd == "flush") {
        d->Flush(); std::cout << "OK\n";
      } else if (cmd == "stats") {
        s = d->GetStats();
        std::cout << "memtable entries=" << s.memtable_entries << " bytes=" << s.memtable_bytes
                  << "  wal bytes=" << s.wal_bytes << "  tables=" << s.tables << "\n";
      } else if (cmd == "quit" || cmd == "exit") break;
      else std::cout << help << "\n";
    } catch (const std::exception& e) { std::cout << "error: " << e.what() << "\n"; }
  }
  d->Close();
  return 0;
}
