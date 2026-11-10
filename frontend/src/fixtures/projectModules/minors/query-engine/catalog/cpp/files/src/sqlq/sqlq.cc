#include "sqlq/sqlq.h"
#include "parse/parser.h"
#include <sstream>
#include <stdexcept>

namespace sqlq {

static catalog::Value Literal(const parse::Expr* e) {
  if (auto* n = dynamic_cast<const parse::IntLit*>(e)) return catalog::Int(n->v);
  if (auto* s = dynamic_cast<const parse::StrLit*>(e)) return catalog::Text(s->v);
  throw std::runtime_error("INSERT values must be literals");
}

DB Open() { return DB{}; }

void DB::Exec(const std::string& sql) {
  auto stmt = parse::Parse(sql);
  if (auto* ct = dynamic_cast<parse::CreateTable*>(stmt.get())) {
    std::vector<catalog::Col> cols;
    for (const auto& c : ct->cols) {
      catalog::Type typ = c.type == parse::TypeName::kText ? catalog::Type::kText : catalog::Type::kInt;
      cols.push_back(catalog::Col{c.name, typ});
    }
    cat.Create(ct->name, cols);
    return;
  }
  if (auto* ins = dynamic_cast<parse::Insert*>(stmt.get())) {
    for (const auto& row : ins->rows) {
      std::vector<catalog::Value> vals;
      for (const auto& e : row) vals.push_back(Literal(e.get()));
      cat.Insert(ins->table, vals);
    }
    return;
  }
  throw std::runtime_error("EXEC does not run SELECT");
}

Result DB::Query(const std::string&) {
  throw std::runtime_error("SELECT runs in the next chapter");
}

std::string Format(const Result& res) {
  std::ostringstream out;
  for (size_t i = 0; i < res.cols.size(); ++i) {
    if (i) out << '\t';
    out << res.cols[i];
  }
  for (const auto& row : res.rows) {
    out << '\n';
    for (size_t i = 0; i < row.size(); ++i) {
      if (i) out << '\t';
      out << row[i].String();
    }
  }
  return out.str();
}

}  // namespace sqlq
