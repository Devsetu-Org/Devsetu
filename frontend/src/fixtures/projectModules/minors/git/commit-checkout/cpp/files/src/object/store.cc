#include "object/store.h"
#include "object/header.h"

#include <fstream>
#include <stdexcept>
#include <sys/stat.h>
#include <zlib.h>

namespace tinygit {
namespace {

bool Exists(const std::string& path) {
  struct stat st;
  return ::stat(path.c_str(), &st) == 0;
}

void MkDirAll(const std::string& path) {
  size_t pos = 0;
  while (true) {
    pos = path.find('/', pos + 1);
    std::string sub = (pos == std::string::npos) ? path : path.substr(0, pos);
    if (!sub.empty()) ::mkdir(sub.c_str(), 0755);
    if (pos == std::string::npos) break;
  }
}

std::string DirName(const std::string& path) {
  auto p = path.rfind('/');
  if (p == std::string::npos) return ".";
  if (p == 0) return "/";
  return path.substr(0, p);
}

std::vector<uint8_t> ZlibCompress(const std::vector<uint8_t>& in) {
  uLongf bound = compressBound(static_cast<uLong>(in.size()));
  std::vector<uint8_t> out(bound);
  uLongf out_len = bound;
  if (compress(out.data(), &out_len, in.data(), static_cast<uLong>(in.size())) != Z_OK)
    throw std::runtime_error("object: zlib compress");
  out.resize(out_len);
  return out;
}

std::vector<uint8_t> ZlibDecompress(const std::vector<uint8_t>& in) {
  uLongf out_len = in.size() * 4 + 64;
  for (int attempt = 0; attempt < 8; ++attempt) {
    std::vector<uint8_t> out(out_len);
    uLongf n = out_len;
    int rc = uncompress(out.data(), &n, in.data(), static_cast<uLong>(in.size()));
    if (rc == Z_OK) {
      out.resize(n);
      return out;
    }
    if (rc != Z_BUF_ERROR) throw std::runtime_error("object: zlib decompress");
    out_len *= 2;
  }
  throw std::runtime_error("object: zlib decompress");
}

}  // namespace

std::string Store::PathFor(const Hash& h) const {
  std::string hx = h.Hex();
  return dir_ + "/" + hx.substr(0, 2) + "/" + hx.substr(2);
}

Hash Store::Put(const std::string& typ, const std::vector<uint8_t>& content) {
  auto raw = EncodeHeader(typ, content);
  Hash h = HashOf(raw);
  std::string path = PathFor(h);
  if (Exists(path)) return h;
  MkDirAll(DirName(path));
  auto compressed = ZlibCompress(raw);
  std::string tmp = path + ".tmp";
  {
    std::ofstream f(tmp, std::ios::binary);
    f.write(reinterpret_cast<const char*>(compressed.data()), static_cast<std::streamsize>(compressed.size()));
  }
  if (std::rename(tmp.c_str(), path.c_str()) != 0) {
    std::remove(tmp.c_str());
    throw std::runtime_error("object: rename failed");
  }
  return h;
}

std::pair<std::string, std::vector<uint8_t>> Store::Get(const Hash& h) const {
  std::string path = PathFor(h);
  std::ifstream f(path, std::ios::binary);
  if (!f) throw std::runtime_error("object: missing " + h.Hex());
  std::vector<uint8_t> compressed((std::istreambuf_iterator<char>(f)), {});
  auto raw = ZlibDecompress(compressed);
  auto pr = SplitHeader(raw);
  if (HashOf(raw) != h) throw std::runtime_error("object: hash mismatch for " + h.Hex());
  return pr;
}

}  // namespace tinygit
