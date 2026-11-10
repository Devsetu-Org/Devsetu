#pragma once
#include "storage/store.h"
#include <string>

namespace storage {
constexpr const char* kFileName = "raft-state";
class File : public Store {
 public:
  explicit File(std::string dir);
  void Save(const std::string& state) override;
  std::string Load() override;
 private:
  std::string dir_;
  std::string TempPath() const;
  std::string FinalPath() const;
};
}  // namespace storage
