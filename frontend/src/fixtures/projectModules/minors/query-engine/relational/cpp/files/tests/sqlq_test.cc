#include "check.h"
#include "lex/lex.h"
#include "parse/parser.h"
#include "catalog/catalog.h"
#include "execute/row.h"
#include "sqlq/sqlq.h"

#include <string>
#include <vector>

TEST(ScanSelect) {
  auto toks = sqlq::lex::Scan("SELECT name FROM users WHERE id = 1;");
  using K = sqlq::lex::Kind;
  std::vector<K> want = {K::kKwSelect, K::kIdent, K::kKwFrom, K::kIdent, K::kKwWhere, K::kIdent, K::kEq, K::kInt, K::kSemicolon, K::kEof};
  CHECK_EQ(toks.size(), want.size());
  for (size_t i = 0; i < want.size(); ++i) CHECK(toks[i].kind == want[i]);
  CHECK_EQ(toks[1].lit, std::string("name"));
  CHECK_EQ(toks[7].lit, std::string("1"));
}

TEST(KeywordCase) {
  auto toks = sqlq::lex::Scan("SeLeCt");
  CHECK(toks[0].kind == sqlq::lex::Kind::kKwSelect);
  CHECK_EQ(toks[0].lit, std::string("SeLeCt"));
}

TEST(StringLit) {
  auto toks = sqlq::lex::Scan("'a''b'");
  CHECK(toks[0].kind == sqlq::lex::Kind::kString);
  CHECK_EQ(toks[0].lit, std::string("a'b"));
}

TEST(Unterminated) {
  bool threw = false;
  try { sqlq::lex::Scan("'abc"); } catch (...) { threw = true; }
  CHECK(threw);
}

TEST(BadChar) {
  bool threw = false;
  try { sqlq::lex::Scan("SELECT @"); } catch (...) { threw = true; }
  CHECK(threw);
}

TEST(ParseSelect) {
  auto stmt = sqlq::parse::Parse("SELECT name FROM users u WHERE id = 1 AND name > 'a'");
  auto* sel = dynamic_cast<sqlq::parse::Select*>(stmt.get());
  CHECK(sel);
  CHECK_EQ(sel->from, std::string("users"));
  CHECK_EQ(sel->alias, std::string("u"));
  CHECK_EQ(sel->items.size(), size_t{1});
  auto* bin = dynamic_cast<sqlq::parse::Binary*>(sel->where.get());
  CHECK(bin);
  CHECK_EQ(bin->op, std::string("AND"));
}

TEST(ParseBroken) {
  bool threw = false;
  try { sqlq::parse::Parse("SELECT FROM t"); } catch (...) { threw = true; }
  CHECK(threw);
}

TEST(ParseCreateInsert) {
  auto stmt = sqlq::parse::Parse("CREATE TABLE users (id INT, name TEXT)");
  auto* ct = dynamic_cast<sqlq::parse::CreateTable*>(stmt.get());
  CHECK(ct);
  CHECK_EQ(ct->name, std::string("users"));
  CHECK_EQ(ct->cols.size(), size_t{2});
  CHECK(ct->cols[1].type == sqlq::parse::TypeName::kText);
  stmt = sqlq::parse::Parse("INSERT INTO users VALUES (1, 'ada'), (2, 'bea')");
  auto* ins = dynamic_cast<sqlq::parse::Insert*>(stmt.get());
  CHECK(ins);
  CHECK_EQ(ins->table, std::string("users"));
  CHECK_EQ(ins->rows.size(), size_t{2});
}

TEST(ParseJoinAgg) {
  auto stmt = sqlq::parse::Parse(
      "SELECT u.name, COUNT(*) FROM users u JOIN orders o ON u.id = o.user_id "
      "GROUP BY u.name ORDER BY count(*) DESC LIMIT 5");
  auto* sel = dynamic_cast<sqlq::parse::Select*>(stmt.get());
  CHECK(sel);
  CHECK(sel->join);
  CHECK_EQ(sel->join->table, std::string("orders"));
  CHECK_EQ(sel->group.size(), size_t{1});
  CHECK_EQ(sel->order.size(), size_t{1});
  CHECK(sel->order[0].desc);
  CHECK(sel->has_limit);
  CHECK_EQ(sel->limit, int64_t{5});
}

TEST(CatalogCreateInsert) {
  sqlq::catalog::DB db;
  db.Create("users", {{"id", sqlq::catalog::Type::kInt}, {"name", sqlq::catalog::Type::kText}});
  bool threw = false;
  try { db.Create("users", {{"id", sqlq::catalog::Type::kInt}}); } catch (...) { threw = true; }
  CHECK(threw);
  db.Insert("users", {sqlq::catalog::Int(1), sqlq::catalog::Text("ada")});
  threw = false;
  try { db.Insert("users", {sqlq::catalog::Text("x")}); } catch (...) { threw = true; }
  CHECK(threw);
  threw = false;
  try { db.Insert("users", {sqlq::catalog::Text("x"), sqlq::catalog::Text("y")}); } catch (...) { threw = true; }
  CHECK(threw);
  CHECK_EQ(db.Lookup("users")->rows.size(), size_t{1});
}

TEST(ScanFilter) {
  sqlq::catalog::DB db;
  db.Create("t", {{"id", sqlq::catalog::Type::kInt}});
  db.Insert("t", {sqlq::catalog::Int(1)});
  db.Insert("t", {sqlq::catalog::Int(2)});
  auto stmt = sqlq::parse::Parse("SELECT id FROM t WHERE id > 1");
  auto* sel = dynamic_cast<sqlq::parse::Select*>(stmt.get());
  auto rows = sqlq::execute::RunSelect(db, *sel);
  CHECK_EQ(rows.size(), size_t{1});
  CHECK_EQ(rows[0].vals[0].i, int64_t{2});
}

static sqlq::DB Setup() {
  auto db = sqlq::Open();
  db.Exec("CREATE TABLE users (id INT, name TEXT)");
  db.Exec("INSERT INTO users VALUES (1, 'ada'), (2, 'bea'), (3, 'cy')");
  db.Exec("CREATE TABLE orders (id INT, user_id INT, total INT)");
  db.Exec("INSERT INTO orders VALUES (1, 1, 5), (2, 1, 20), (3, 2, 15)");
  return db;
}

TEST(FilterProject) {
  auto db = Setup();
  auto res = db.Query("SELECT name FROM users WHERE id = 1");
  CHECK_EQ(res.rows.size(), size_t{1});
  CHECK_EQ(res.rows[0][0].String(), std::string("ada"));
}

TEST(AndWhere) {
  auto db = Setup();
  auto res = db.Query("SELECT id FROM users WHERE id > 1 AND name < 'cy'");
  CHECK_EQ(res.rows.size(), size_t{1});
  CHECK_EQ(res.rows[0][0].String(), std::string("2"));
}

TEST(JoinGroupOrderLimit) {
  auto db = Setup();
  auto res = db.Query(
      "SELECT u.name, COUNT(*) AS n FROM users u JOIN orders o ON u.id = o.user_id "
      "WHERE o.total > 10 GROUP BY u.name ORDER BY n DESC LIMIT 1");
  CHECK_EQ(res.rows.size(), size_t{1});
  CHECK_EQ(res.rows[0][0].String(), std::string("ada"));
  CHECK_EQ(res.rows[0][1].String(), std::string("1"));
}

TEST(SumAgg) {
  auto db = Setup();
  auto res = db.Query("SELECT SUM(total) FROM orders");
  CHECK_EQ(res.rows.size(), size_t{1});
  CHECK_EQ(res.rows[0][0].String(), std::string("40"));
}

TEST(BadInsert) {
  auto db = Setup();
  bool threw = false;
  try { db.Exec("INSERT INTO users VALUES ('nope', 'x')"); } catch (...) { threw = true; }
  CHECK(threw);
}

int main() { return check::RunAll(); }
