#include "pager/pager.h"

#include <cctype>
#include <cstring>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

using namespace btreekv;

static const char* kHelp = R"(commands:
  alloc               allocate a page
  free <n>            free page n
  write <n> <text>    write text into page n
  read <n>            read page n back
  meta                show the header state
  quit)";

int main(int argc, char** argv) {
  std::string file = "data.db";
  for (int i = 1; i < argc; ++i) {
    std::string a = argv[i];
    if (a == "--file" && i + 1 < argc) {
      file = argv[++i];
    }
  }

  Pager p = Pager::Open(file);
  std::cout << "btreekv: pager (chapter 1). file=" << file << ", " << p.meta().page_count
            << " pages. Type 'help'.\n";

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
    for (char& c : cmd) c = static_cast<char>(::tolower(c));
    if (cmd.empty()) continue;
    try {
      if (cmd == "alloc") {
        std::cout << "page " << p.Allocate() << "\n";
      } else if (cmd == "free") {
        PageNo no;
        iss >> no;
        p.Free(no);
        std::cout << "OK\n";
      } else if (cmd == "write") {
        PageNo no;
        iss >> no;
        std::string text;
        std::getline(iss, text);
        if (!text.empty() && text[0] == ' ') text.erase(0, 1);
        std::vector<uint8_t> buf(kPageSize, 0);
        std::memcpy(buf.data(), text.data(), std::min(text.size(), size_t(kUsable)));
        p.WritePage(no, buf.data(), buf.size());
        std::cout << "OK\n";
      } else if (cmd == "read") {
        PageNo no;
        iss >> no;
        std::vector<uint8_t> buf(kPageSize);
        p.ReadPage(no, buf.data(), buf.size());
        size_t end = kUsable;
        while (end > 0 && buf[end - 1] == 0) --end;
        std::cout << '"' << std::string(reinterpret_cast<char*>(buf.data()), end) << "\"\n";
      } else if (cmd == "meta") {
        Meta m = p.meta();
        std::cout << "root=" << m.root << " pages=" << m.page_count
                  << " freelist head=" << m.free_head << "\n";
      } else if (cmd == "quit" || cmd == "exit") {
        break;
      } else {
        std::cout << kHelp << "\n";
      }
    } catch (const std::exception& e) {
      std::cout << "error: " << e.what() << "\n";
    }
  }
  p.Close();
  return 0;
}
