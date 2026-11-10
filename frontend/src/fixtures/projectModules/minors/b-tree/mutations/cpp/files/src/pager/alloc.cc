#include "pager/pager.h"

#include <vector>

namespace btreekv {

PageNo Pager::Allocate() {
  std::lock_guard<std::mutex> lock(mu_);
  if (meta_.free_head != 0) {
    PageNo head = meta_.free_head;
    std::vector<uint8_t> buf(kPageSize);
    ReadPage(head, buf.data(), buf.size());
    meta_.free_head = DecodeFreePage(buf.data());
    return head;
  }
  PageNo no = meta_.page_count;
  std::vector<uint8_t> blank(kPageSize, 0);
  WritePage(no, blank.data(), blank.size());
  meta_.page_count++;
  return no;
}

void Pager::Free(PageNo no) {
  std::lock_guard<std::mutex> lock(mu_);
  if (no == 0 || no >= meta_.page_count) {
    throw BadPageError("pager: bad page: cannot free page");
  }
  std::vector<uint8_t> buf(kPageSize, 0);
  EncodeFreePage(buf.data(), meta_.free_head);
  WritePage(no, buf.data(), buf.size());
  meta_.free_head = no;
}

}  // namespace btreekv
