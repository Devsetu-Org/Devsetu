#include "lex/lex.h"
#include <iostream>
#include <string>

int main() {
  std::string src((std::istreambuf_iterator<char>(std::cin)), std::istreambuf_iterator<char>());
  try {
    auto toks = sqlq::lex::Scan(src);
    for (const auto& t : toks) {
      if (t.kind == sqlq::lex::Kind::kEof) break;
      bool show_lit = !t.lit.empty() &&
          (t.kind == sqlq::lex::Kind::kIdent || t.kind == sqlq::lex::Kind::kInt || t.kind == sqlq::lex::Kind::kString);
      if (!t.lit.empty() && !show_lit) {
        std::cout << sqlq::lex::KindName(t.kind) << "\n";
        continue;
      }
      if (show_lit) {
        std::cout << sqlq::lex::KindName(t.kind) << " " << t.lit << "\n";
        continue;
      }
      std::cout << sqlq::lex::KindName(t.kind) << "\n";
    }
  } catch (const std::exception& e) {
    std::cerr << e.what() << "\n";
    return 1;
  }
}
