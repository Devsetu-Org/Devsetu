#pragma once

#include "btree/tree.h"
#include "pager/pager.h"

#include <functional>
#include <memory>
#include <mutex>
#include <string>

namespace btreekv {

struct Options {};

struct DBStats {
  int pages = 0;
  int free_pages = 0;
  int height = 0;
  int leaves = 0;
  int internal = 0;
  int keys = 0;
  int64_t wal_bytes = 0;
  int resident = 0;
  int dirty = 0;
};

class ClosedError : public std::runtime_error {
 public:
  using std::runtime_error::runtime_error;
};
class NotYetError : public std::runtime_error {
 public:
  using std::runtime_error::runtime_error;
};

class DB {
 public:
  static DB Open(const std::string& dir, Options opts = {});
  ~DB();

  DB(const DB&) = delete;
  DB& operator=(const DB&) = delete;
  DB(DB&&) noexcept;
  DB& operator=(DB&&) noexcept;

  void Put(std::string_view key, std::string_view value);
  bool Get(std::string_view key, std::string* value);
  void Delete(std::string_view key);
  void Scan(std::string_view start, std::string_view end,
            const std::function<bool(std::string_view, std::string_view)>& fn);
  DBStats Stats();
  void Close();

 private:
  DB(std::string dir, Options opts, std::unique_ptr<Pager> pg);

  mutable std::mutex mu_;
  std::string dir_;
  Options opts_;
  std::unique_ptr<Pager> pg_;
  std::unique_ptr<PagerIO> io_;
  std::unique_ptr<Tree> tree_;
  bool closed_ = false;
};

}  // namespace btreekv
