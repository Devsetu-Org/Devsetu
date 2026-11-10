#include "execute/row.h"
#include <stdexcept>

namespace sqlq {
namespace execute {

namespace {
struct SliceIter : Iter {
  std::vector<Row> rows;
  size_t i = 0;
  explicit SliceIter(std::vector<Row> r) : rows(std::move(r)) {}
  std::pair<Row, bool> Next() override {
    if (i >= rows.size()) return {Row{}, false};
    return {rows[i++], true};
  }
};

Row ProjectItems(const std::vector<parse::SelectItem>& items, const Row& row) {
  Row out;
  for (const auto& item : items) {
    if (item.star) {
      out.cols.insert(out.cols.end(), row.cols.begin(), row.cols.end());
      out.vals.insert(out.vals.end(), row.vals.begin(), row.vals.end());
      continue;
    }
    auto v = Eval(item.expr.get(), row);
    std::string name = item.alias.empty() ? parse::Name(item.expr.get()) : item.alias;
    out.cols.push_back(name);
    out.vals.push_back(v);
  }
  if (out.cols.empty()) throw std::runtime_error("empty select list");
  return out;
}
}  // namespace

std::vector<Row> RunSelect(catalog::DB& db, const parse::Select& sel) {
  catalog::Table* left = db.Lookup(sel.from);
  std::string qual = sel.alias.empty() ? sel.from : sel.alias;
  std::unique_ptr<Iter> it = NewScan(*left, qual);
  if (sel.where) {
    auto f = std::make_unique<Filter>();
    const parse::Expr* pred = sel.where.get();
    f->pred = [pred](const Row& row) { return Truth(pred, row); };
    f->child = std::move(it);
    it = std::move(f);
  }
  auto rows = ReadAll(*it);
  auto proj = std::make_unique<Project>();
  proj->pick = [&](const Row& row) { return ProjectItems(sel.items, row); };
  proj->child = std::make_unique<SliceIter>(std::move(rows));
  return ReadAll(*proj);
}

}  // namespace execute
}  // namespace sqlq
