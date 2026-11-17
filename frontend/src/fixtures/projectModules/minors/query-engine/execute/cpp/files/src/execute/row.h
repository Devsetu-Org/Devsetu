#pragma once
#include <functional>
#include <memory>
#include <string>
#include <utility>
#include <vector>
#include "catalog/catalog.h"
#include "parse/ast.h"

namespace sqlq {
namespace execute {

struct Row {
  std::vector<std::string> cols;
  std::vector<catalog::Value> vals;
  std::pair<catalog::Value, bool> Get(const std::string& name) const;
};

struct Iter {
  virtual ~Iter() = default;
  virtual std::pair<Row, bool> Next() = 0;
};

std::vector<Row> ReadAll(Iter& it);

struct Scan : Iter {
  std::vector<std::string> cols;
  std::vector<std::vector<catalog::Value>> rows;
  size_t i = 0;
  std::pair<Row, bool> Next() override;
};

std::unique_ptr<Scan> NewScan(const catalog::Table& t, const std::string& qualifier);

struct Filter : Iter {
  std::unique_ptr<Iter> child;
  std::function<bool(const Row&)> pred;
  std::pair<Row, bool> Next() override;
};

struct Project : Iter {
  std::unique_ptr<Iter> child;
  std::function<Row(const Row&)> pick;
  std::pair<Row, bool> Next() override;
};

catalog::Value Eval(const parse::Expr* e, const Row& row);
bool Truth(const parse::Expr* e, const Row& row);
std::vector<Row> RunSelect(catalog::DB& db, const parse::Select& sel);

}  // namespace execute
}  // namespace sqlq
