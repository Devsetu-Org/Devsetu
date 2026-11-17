#pragma once

#include <cstdint>

namespace findx {
namespace postings {

struct Posting {
  uint32_t doc_id = 0;
  uint32_t tf = 0;

  bool operator==(const Posting& o) const { return doc_id == o.doc_id && tf == o.tf; }
};

}  // namespace postings
}  // namespace findx
