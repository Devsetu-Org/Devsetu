#pragma once

#include "index/engine.h"

#include <string>
#include <vector>

namespace findx {

struct Hit {
  std::string id;
  double score = 0;
};

class Index {
 public:
  explicit Index(index::Engine eng);

  void Add(const std::string& id, const std::string& text);
  void Flush();
  std::vector<Hit> Search(const std::string& q, int k);

 private:
  index::Engine eng_;
};

Index Open(const std::string& dir);

}  // namespace findx
