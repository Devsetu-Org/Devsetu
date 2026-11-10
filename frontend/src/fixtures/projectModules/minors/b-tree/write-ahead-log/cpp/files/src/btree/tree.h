#pragma once

#include "btree/node.h"
#include "pager/pager.h"

#include <memory>
#include <optional>
#include <string>
#include <string_view>

namespace btreekv {

class PageIO {
 public:
  virtual ~PageIO() = default;
  virtual void ReadPage(PageNo no, uint8_t* buf, size_t len) = 0;
  virtual void WritePage(PageNo no, const uint8_t* buf, size_t len) = 0;
  virtual PageNo Allocate() = 0;
  virtual void Free(PageNo no) = 0;
  virtual PageNo Root() const = 0;
  virtual void SetRoot(PageNo no) = 0;
};

// Adapter so Pager satisfies PageIO.
class PagerIO : public PageIO {
 public:
  explicit PagerIO(Pager* p) : p_(p) {}
  void ReadPage(PageNo no, uint8_t* buf, size_t len) override { p_->ReadPage(no, buf, len); }
  void WritePage(PageNo no, const uint8_t* buf, size_t len) override { p_->WritePage(no, buf, len); }
  PageNo Allocate() override { return p_->Allocate(); }
  void Free(PageNo no) override { p_->Free(no); }
  PageNo Root() const override { return p_->Root(); }
  void SetRoot(PageNo no) override { p_->SetRoot(no); }

 private:
  Pager* p_;
};

struct Promoted {
  std::string sep;
  PageNo right;
};

struct TreeStats {
  int height = 0;
  int leaves = 0;
  int internal = 0;
  int keys = 0;
};

class Tree {
 public:
  explicit Tree(PageIO* io) : io_(io) {}

  Node Load(PageNo no);
  void Store(PageNo no, const Node& n);
  PageNo NewPage(const Node& n);

  // Student (search.cc)
  PageNo FindLeaf(std::string_view key, Node* out_leaf);  // returns 0 if empty; out_leaf set if non-null path
  bool Get(std::string_view key, std::string* value);

  // Student (insert.cc)
  void Insert(std::string_view key, std::string_view val);

  TreeStats Check();

  PageIO* io() { return io_; }

  // Used by insert.cc
  std::optional<Promoted> InsertRec(PageNo no, std::string_view key, std::string_view val);

 private:
  PageIO* io_;
};

void CheckEntry(std::string_view key, std::string_view val);

// Node methods implemented in search.cc / insert.cc
int ChildIndex(const Node& n, std::string_view key);
std::pair<int, bool> LeafIndex(const Node& n, std::string_view key);
void LeafPut(Node& n, std::string_view key, std::string_view val);
std::pair<Node, std::string> Split(Node& n);

class EmptyKeyError : public std::runtime_error {
 public:
  using std::runtime_error::runtime_error;
};
class KeyTooLargeError : public std::runtime_error {
 public:
  using std::runtime_error::runtime_error;
};
class ValueTooLargeError : public std::runtime_error {
 public:
  using std::runtime_error::runtime_error;
};

}  // namespace btreekv
