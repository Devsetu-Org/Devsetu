#pragma once
#include <string>
#include <vector>
#include "catalog/catalog.h"

namespace sqlq {

struct Result {
  std::vector<std::string> cols;
  std::vector<std::vector<catalog::Value>> rows;
};

class DB {
 public:
  void Exec(const std::string& sql);
  Result Query(const std::string& sql);
  catalog::DB cat;
};

DB Open();
std::string Format(const Result& res);

}  // namespace sqlq
