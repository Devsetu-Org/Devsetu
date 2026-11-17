#include "lex/lex.h"
#include <iostream>
#include <iterator>
#include <string>

int main() {
  std::string src((std::istreambuf_iterator<char>(std::cin)), std::istreambuf_iterator<char>());
  try {
    auto toks = tinysh::lex::Scan(src);
    for (auto& t : toks) {
      if (t.kind == tinysh::lex::kEOF) break;
      if (t.kind == tinysh::lex::kWord) {
        std::cout << tinysh::lex::KindName(t.kind) << " " << t.lit << "\n";
      } else {
        std::cout << tinysh::lex::KindName(t.kind) << "\n";
      }
    }
  } catch (const std::exception& e) {
    std::cerr << e.what() << "\n";
    return 1;
  }
  return 0;
}
