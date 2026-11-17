#include "analyze/analyze.h"

#include <iostream>
#include <string>

int main() {
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
