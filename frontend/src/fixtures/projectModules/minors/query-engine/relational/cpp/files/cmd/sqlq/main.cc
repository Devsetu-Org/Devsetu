#include "sqlq/sqlq.h"
#include <cctype>
#include <iostream>
#include <string>

int main() {
  auto db = sqlq::Open();
  std::cerr << "sqlq. End a statement with ;\n";
  std::string buf, line;
  while (true) {
    std::cerr << "sqlq> ";
    if (!std::getline(std::cin, line)) return 0;
    buf += line;
    buf.push_back('\n');
    if (line.find(';') == std::string::npos) continue;
    std::string stmt = buf;
    buf.clear();
    std::string upper;
    for (char c : stmt) upper.push_back(static_cast<char>(std::toupper(static_cast<unsigned char>(c))));
    // trim-ish
    size_t start = upper.find_first_not_of(" \t\n\r");
    if (start != std::string::npos && upper.compare(start, 6, "SELECT") == 0) {
      try {
        auto res = db.Query(stmt);
        std::cout << sqlq::Format(res) << "\n";
      } catch (const std::exception& e) {
        std::cerr << e.what() << "\n";
      }
      continue;
    }
    try {
      db.Exec(stmt);
    } catch (const std::exception& e) {
      std::cerr << e.what() << "\n";
    }
  }
}
