#include "db/db.h"
#include <stdexcept>
namespace lsmkv { namespace db {
void DB::compactRange(int lo, int hi) {
  (void)lo; (void)hi;
  throw std::logic_error("TODO(5.3): compactRange");
}
}} 
