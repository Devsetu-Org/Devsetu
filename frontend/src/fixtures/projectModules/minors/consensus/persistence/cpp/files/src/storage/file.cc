#include "storage/file.h"
#include <stdexcept>
namespace storage {
File::File(std::string dir) : dir_(std::move(dir)) {
  // mkdir handled by caller / NewFile helper
}
std::string File::TempPath() const { return dir_ + "/" + kFileName + ".tmp"; }
std::string File::FinalPath() const { return dir_ + "/" + kFileName; }
void File::Save(const std::string& state) {
  (void)state;
  // TODO(4.3)
  throw std::runtime_error("TODO(4.3)");
}
std::string File::Load() {
  // TODO(4.4)
  throw std::runtime_error("TODO(4.4)");
}
}  // namespace storage
