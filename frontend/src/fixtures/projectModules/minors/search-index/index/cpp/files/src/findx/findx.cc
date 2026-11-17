#include "findx/findx.h"

namespace findx {

Index::Index(index::Engine eng) : eng_(std::move(eng)) {}

void Index::Add(const std::string& id, const std::string& text) { eng_.Add(id, text); }

void Index::Flush() { eng_.Flush(); }

Index Open(const std::string& dir) { return Index(index::Open(dir)); }

}  // namespace findx
