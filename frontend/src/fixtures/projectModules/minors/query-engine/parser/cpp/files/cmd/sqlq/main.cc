#include "parse/parser.h"
#include <iostream>
#include <string>

int main() {
  std::string src((std::istreambuf_iterator<char>(std::cin)), std::istreambuf_iterator<char>());
  try {
    auto stmt = sqlq::parse::Parse(src);
    if (auto* s = dynamic_cast<sqlq::parse::Select*>(stmt.get())) {
      std::cout << "SELECT " << s->items.size() << " cols FROM " << s->from << "\n";
    } else {
      std::cout << "stmt\n";
    }
  } catch (const std::exception& e) {
    std::cerr << e.what() << "\n";
    return 1;
  }
}
