#pragma once
#include "object/store.h"
#include <memory>
#include <string>

namespace tinygit {

inline constexpr const char* kDirName = ".tinygit";

class Repo {
 public:
  explicit Repo(std::string root) : root_(std::move(root)) {}
  const std::string& Root() const { return root_; }
  std::string GitDir() const { return root_ + "/" + kDirName; }
  Store Objects() const { return Store(GitDir() + "/objects"); }
  std::string IndexPath() const { return GitDir() + "/index"; }

 private:
  std::string root_;
};

Repo Init(const std::string& root);
Repo Open(const std::string& path);

}  // namespace tinygit
