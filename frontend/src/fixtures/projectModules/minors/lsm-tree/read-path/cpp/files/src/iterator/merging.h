#pragma once
#include <functional>
#include <memory>
#include <string>
#include <string_view>
#include <vector>
#include "memtable/skiplist.h"
namespace lsmkv { namespace it {
struct Cursor {
  std::function<void()> SeekToFirst;
  std::function<void(std::string_view)> Seek;
  std::function<bool()> Valid;
  std::function<void()> Next;
  std::function<std::string_view()> Key;
  std::function<std::string_view()> Value;
  std::function<Kind()> kind;
};
class Merging {
 public:
  explicit Merging(std::vector<Cursor> children);
  void SeekToFirst();
  void Seek(std::string_view target);
  bool Valid() const;
  void Next();  // student
  std::string_view Key() const;
  std::string_view Value() const;
  Kind kind() const;
  // student Less used via heap
  struct Item { Cursor* it; int rank; };
  static bool Less(const Item& a, const Item& b);  // student
 private:
  void rebuild();
  std::vector<Cursor> children_;
  std::vector<Item> h_;
};
}} 
