#include "execute/row.h"
#include <map>
#include <stdexcept>

namespace sqlq {
namespace execute {

static std::string GroupKey(const Row& row, const std::vector<std::unique_ptr<parse::Expr>>& group) {
  if (group.empty()) return "";
  std::string key;
  for (size_t i = 0; i < group.size(); ++i) {
    if (i) key.push_back('\0');
    key += Eval(group[i].get(), row).String();
  }
  return key;
}

static Row EmitGroup(const Row& sample, int64_t count, const std::map<int, int64_t>& sums,
                     const std::vector<parse::SelectItem>& items) {
  Row out;
  for (size_t i = 0; i < items.size(); ++i) {
    const auto& item = items[i];
    std::string name = item.alias;
    if (name.empty()) {
      if (item.star) name = "*";
      else name = parse::Name(item.expr.get());
    }
    catalog::Value v;
    if (auto* call = dynamic_cast<const parse::Call*>(item.expr.get())) {
      if (call->star || call->name == "count") v = catalog::Int(count);
      else {
        auto it = sums.find(static_cast<int>(i));
        v = catalog::Int(it == sums.end() ? 0 : it->second);
      }
    } else {
      if (item.star) throw std::runtime_error("SELECT * cannot be aggregated");
      v = Eval(item.expr.get(), sample);
    }
    out.cols.push_back(name);
    out.vals.push_back(v);
  }
  return out;
}

std::vector<Row> Aggregate(const std::vector<Row>& rows,
                           const std::vector<parse::SelectItem>& items,
                           const std::vector<std::unique_ptr<parse::Expr>>& group) {
  struct Acc {
    Row first;
    int64_t count = 0;
    std::map<int, int64_t> sums;
  };
  std::map<std::string, Acc> buckets;
  std::vector<std::string> order;
  for (const auto& row : rows) {
    std::string key = GroupKey(row, group);
    auto it = buckets.find(key);
    if (it == buckets.end()) {
      Acc a;
      a.first = row;
      buckets.emplace(key, std::move(a));
      order.push_back(key);
      it = buckets.find(key);
    }
    it->second.count++;
    for (size_t i = 0; i < items.size(); ++i) {
      auto* call = dynamic_cast<const parse::Call*>(items[i].expr.get());
      if (!call || call->star || call->name != "sum") continue;
      auto v = Eval(call->arg.get(), row);
      if (v.t != catalog::Type::kInt) throw std::runtime_error("SUM needs INT");
      it->second.sums[static_cast<int>(i)] += v.i;
    }
  }
  if (rows.empty() && group.empty()) {
    order = {""};
    buckets[""] = Acc{};
  }
  std::vector<Row> out;
  for (const auto& key : order) {
    const Acc& b = buckets[key];
    out.push_back(EmitGroup(b.first, b.count, b.sums, items));
  }
  return out;
}

}  // namespace execute
}  // namespace sqlq
