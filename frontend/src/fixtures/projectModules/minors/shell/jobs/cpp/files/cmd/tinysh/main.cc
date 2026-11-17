#include "exec/shell.h"
#include <iostream>
#include <string>

int main() {
  auto sh = tinysh::exe::New();
  std::string line;
  while (std::getline(std::cin, line)) {
    int status = sh.RunLine(line);
    if (sh.Exited()) return sh.LastStatus();
    (void)status;
  }
  return 0;
}
