#include "storage/file.h"
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>
#include <fstream>
#include <stdexcept>
namespace storage {
File::File(std::string dir) : dir_(std::move(dir)) {
  mkdir(dir_.c_str(), 0755);
}
std::string File::TempPath() const { return dir_ + "/" + kFileName + ".tmp"; }
std::string File::FinalPath() const { return dir_ + "/" + kFileName; }
void File::Save(const std::string& state) {
  auto tmp = TempPath();
  {
    std::ofstream out(tmp, std::ios::binary | std::ios::trunc);
    out.write(state.data(), static_cast<std::streamsize>(state.size()));
    out.flush();
  }
  int fd = ::open(tmp.c_str(), O_RDONLY);
  if (fd >= 0) { ::fsync(fd); ::close(fd); }
  if (::rename(tmp.c_str(), FinalPath().c_str()) != 0) throw std::runtime_error("rename");
  int dfd = ::open(dir_.c_str(), O_RDONLY);
  if (dfd >= 0) { ::fsync(dfd); ::close(dfd); }
}
std::string File::Load() {
  std::ifstream in(FinalPath(), std::ios::binary);
  if (!in) return {};
  return std::string((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
}
}  // namespace storage
