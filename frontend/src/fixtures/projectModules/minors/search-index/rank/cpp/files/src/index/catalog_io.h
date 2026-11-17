#pragma once

#include "index/engine.h"

#include <string>

namespace findx {
namespace index {

inline const char* CatalogName() { return "catalog.json"; }

void WriteCatalogFile(const Engine& e);
void LoadCatalog(Engine* e, const std::string& path);

}  // namespace index
}  // namespace findx
