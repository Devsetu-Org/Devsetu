#pragma once

#include "index/engine.h"

#include <string>

namespace findx {

class Index {
 public:
  explicit Index(index::Engine eng);

  void Add(const std::string& id, const std::string& text);
  void Flush();

 private:
  index::Engine eng_;
};

Index Open(const std::string& dir);

}  // namespace findx
