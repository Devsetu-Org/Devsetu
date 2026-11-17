#include "iterator/merging.h"
#include <algorithm>
namespace lsmkv { namespace it {
Merging::Merging(std::vector<Cursor> children) : children_(std::move(children)) {}
bool Merging::Less(const Item& a, const Item& b) {
  int c = a.it->Key().compare(b.it->Key());
  if (c != 0) return c < 0;
  return a.rank < b.rank;
}
void Merging::SeekToFirst() { for (auto& c : children_) c.SeekToFirst(); rebuild(); }
void Merging::Seek(std::string_view t) { for (auto& c : children_) c.Seek(t); rebuild(); }
void Merging::rebuild() {
  h_.clear();
  for (int i = 0; i < (int)children_.size(); ++i) if (children_[i].Valid()) h_.push_back({&children_[i], i});
  std::make_heap(h_.begin(), h_.end(), [](const Item& a, const Item& b){ return !Less(a,b); });
}
bool Merging::Valid() const { return !h_.empty(); }
std::string_view Merging::Key() const { return h_.front().it->Key(); }
std::string_view Merging::Value() const { return h_.front().it->Value(); }
Kind Merging::kind() const { return h_.front().it->kind(); }
void Merging::Next() {
  std::string key(h_.front().it->Key());
  auto cmp = [](const Item& a, const Item& b){ return !Less(a,b); };
  while (!h_.empty() && h_.front().it->Key() == key) {
    Item top = h_.front();
    std::pop_heap(h_.begin(), h_.end(), cmp); h_.pop_back();
    top.it->Next();
    if (top.it->Valid()) { h_.push_back(top); std::push_heap(h_.begin(), h_.end(), cmp); }
  }
}
}} 
