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
  // returns {row, ok}; throws on error
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
bool HasAggregate(const parse::Select& sel);
std::vector<Row> Aggregate(const std::vector<Row>& rows,
                           const std::vector<parse::SelectItem>& items,
                           const std::vector<std::unique_ptr<parse::Expr>>& group);

struct NestedLoop : Iter {
  std::unique_ptr<Iter> left;
  std::vector<Row> right;
  const parse::Expr* on_l = nullptr;
  const parse::Expr* on_r = nullptr;
  Row cur;
  size_t rj = 0;
  bool primed = false;
  std::pair<Row, bool> Next() override;
};

std::unique_ptr<NestedLoop> NewNestedLoop(std::unique_ptr<Iter> left, std::vector<Row> right,
                                          const parse::Expr* on_l, const parse::Expr* on_r);

void SortRows(std::vector<Row>& rows, const std::vector<parse::OrderKey>& keys);
std::vector<Row> LimitRows(std::vector<Row> rows, int n);

}  // namespace execute
}  // namespace sqlq
