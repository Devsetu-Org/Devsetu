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
  throw std::runtime_error("TODO(4.3): File::Save");
}
std::string File::Load() {
  throw std::runtime_error("TODO(4.4): File::Load");
}
}  // namespace storage
