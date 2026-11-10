#include "index/engine.h"

#include "analyze/analyze.h"

#include <stdexcept>

namespace findx {
namespace index {

void Engine::Add(const std::string& id, const std::string& text) {
  // TODO(3.1): Reject an empty id and a duplicate ext_to_id entry.
  // tokens := analyze::Analyze(text). Count tf per term. Assign docID := next_doc
  // and increment. Store Meta{ext_id, length}, update ext_to_id and buf_lens,
  // then mem.Add(term, docID, tf) for each term.
  (void)id;
  (void)text;
  (void)analyze::Analyze;
  throw std::logic_error("TODO(3.1): Engine::Add");
}

}  // namespace index
}  // namespace findx
