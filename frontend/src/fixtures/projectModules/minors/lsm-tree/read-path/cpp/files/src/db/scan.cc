#include "db/db.h"
#include <stdexcept>
namespace lsmkv { namespace db {
void DB::Scan(std::string_view start, std::string_view end,
              const std::function<bool(std::string_view, std::string_view)>& fn) {
  (void)start;(void)end;(void)fn;
  throw std::logic_error("TODO(4.4): Scan");
}
}} 
