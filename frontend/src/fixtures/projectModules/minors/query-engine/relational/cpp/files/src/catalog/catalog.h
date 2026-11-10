#pragma once
#include <string>
#include <unordered_map>
#include <vector>

namespace sqlq {
namespace catalog {

enum class Type { kInt, kText, kBool };

struct Value {
  Type t = Type::kInt;
  int64_t i = 0;
  std::string s;
  bool b = false;
  std::string String() const;
};

inline Value Int(int64_t n) { return Value{Type::kInt, n, "", false}; }
inline Value Text(std::string s) { return Value{Type::kText, 0, std::move(s), false}; }
inline Value Bool(bool b) { return Value{Type::kBool, 0, "", b}; }

struct Col { std::string name; Type type; };
struct Table {
  std::string name;
  std::vector<Col> cols;
  std::vector<std::vector<Value>> rows;
};

class DB {
 public:
  Table* Lookup(const std::string& name);
  void Create(const std::string& name, const std::vector<Col>& cols);
  void Insert(const std::string& name, const std::vector<Value>& row);
  std::unordered_map<std::string, Table> tables;
};

DB* New();  // returns owned; use unique or stack - we'll use value Open

}  // namespace catalog
}  // namespace sqlq
