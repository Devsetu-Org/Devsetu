#include "object/blob.h"
#include "object/hash.h"
#include "repo/repo.h"
#include <iostream>
#include <fstream>
#include <string>
#include <vector>

using namespace tinygit;

static void Usage() {
  std::cerr << "tinygit <command>\n  init | hash-object | cat-file\n";
}

int main(int argc, char** argv) {
  if (argc < 2) { Usage(); return 2; }
  try {
    std::string cmd = argv[1];
    if (cmd == "init") {
      std::string root = argc > 2 ? argv[2] : ".";
      auto r = Init(root);
      std::cout << "initialized " << r.GitDir() << "\n";
      return 0;
    }
    if (cmd == "hash-object") {
      if (argc < 3) throw std::runtime_error("hash-object <file>");
      auto r = Open(".");
      auto s = r.Objects();
      std::ifstream f(argv[2], std::ios::binary);
      std::vector<uint8_t> data((std::istreambuf_iterator<char>(f)), {});
      std::cout << PutBlob(s, data).Hex() << "\n";
      return 0;
    }
    if (cmd == "cat-file") {
      if (argc < 4) throw std::runtime_error("cat-file -t|-p <hash>");
      auto s = Open(".").Objects();
      auto pr = s.Get(ParseHex(argv[3]));
      if (std::string(argv[2]) == "-t") { std::cout << pr.first << "\n"; return 0; }
      std::cout.write(reinterpret_cast<const char*>(pr.second.data()), pr.second.size());
      return 0;
    }
    Usage();
    return 1;
  } catch (const std::exception& e) {
    std::cerr << e.what() << "\n";
    return 1;
  }
}
