#include "index/engine.h"

#include "analyze/analyze.h"

#include <stdexcept>
#include <unordered_map>

namespace findx {
namespace index {

void Engine::Add(const std::string& id, const std::string& text) {
  if (id.empty()) throw std::invalid_argument("empty document id");
  if (ext_to_id.count(id)) throw std::invalid_argument("duplicate document id");
  auto tokens = analyze::Analyze(text);
  std::unordered_map<std::string, uint32_t> tf;
  for (const auto& t : tokens) ++tf[t];
  uint32_t doc_id = next_doc++;
  docs[doc_id] = Meta{id, static_cast<int>(tokens.size())};
  ext_to_id[id] = doc_id;
  buf_lens[doc_id] = static_cast<int>(tokens.size());
  for (const auto& kv : tf) mem.Add(kv.first, doc_id, kv.second);
}

}  // namespace index
}  // namespace findx
