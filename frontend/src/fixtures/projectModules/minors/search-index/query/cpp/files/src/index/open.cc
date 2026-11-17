#include "index/engine.h"

#include "index/catalog_io.h"

#include <sys/stat.h>

#include <fstream>
#include <stdexcept>

namespace findx {
namespace index {

Engine Open(const std::string& dir) {
  ::mkdir(dir.c_str(), 0755);
  Engine e;
  e.dir = dir;
  std::string path = dir + "/" + CatalogName();
  std::ifstream in(path);
  if (!in) {
    e.WriteCatalog();
    return e;
  }
  LoadCatalog(&e, path);
  return e;
}

}  // namespace index
}  // namespace findx
