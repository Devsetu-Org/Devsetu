#include "labharness/cluster.h"

#include <iostream>
#include <sstream>
#include <string>

int main() {
  labharness::Cluster c(3);
  std::cout << "raftkv: 3 nodes running. Type help / status / cut N / heal / quit\n";
  std::string line;
  while (std::cout << "> " && std::getline(std::cin, line)) {
    std::istringstream in(line);
    std::string cmd;
    in >> cmd;
    if (cmd.empty()) continue;
    if (cmd == "quit" || cmd == "exit") break;
    if (cmd == "help") {
      std::cout << "status | cut N | heal | crash N | restart N | quit\n";
      continue;
    }
    if (cmd == "status") {
      for (int i = 0; i < c.N(); ++i) {
        if (!c.Up(i)) {
          std::cout << "node " << i << "  down\n";
          continue;
        }
        auto st = c.State(i);
        std::cout << "node " << i << "  " << raft::RoleName(st.role) << " term " << st.term
                  << " votedFor " << st.voted_for << " log " << st.log.size() << "\n";
      }
      continue;
    }
    int n = -1;
    in >> n;
    if (cmd == "cut" && n >= 0) c.Disconnect(n);
    else if (cmd == "heal") c.Heal();
    else if (cmd == "crash" && n >= 0) c.Crash(n);
    else if (cmd == "restart" && n >= 0 && !c.Up(n)) c.Restart(n);
    else std::cout << "unknown; try help\n";
  }
  return 0;
}
