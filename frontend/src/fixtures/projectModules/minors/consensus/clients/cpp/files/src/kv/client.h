#pragma once
#include "kv/op.h"
#include "labrpc/labrpc.h"
#include <memory>
#include <vector>
namespace kv {
class Clerk {
 public:
  explicit Clerk(std::vector<std::shared_ptr<labrpc::ClientEnd>> ends);
  void Put(const std::string& key, const std::string& value);
  void Delete(const std::string& key);
  std::pair<std::string, bool> Get(const std::string& key);
  Result Do(Op op);  // TODO 5.4
  double timeout_ = 10.0;
 private:
  std::vector<std::shared_ptr<labrpc::ClientEnd>> ends_;
  int64_t id_;
  int64_t seq_ = 0;
  int leader_ = 0;
};
}  // namespace kv
