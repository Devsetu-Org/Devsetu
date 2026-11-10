#include "buffer/pool.h"

#include <stdexcept>

namespace btreekv {

Frame* Pool::Pin(PageNo no, bool load) {
  // TODO(4.1): Hit: if table has no, pins++, ref=true, return frame.
  // Miss: Victim() picks a frame. If used, FlushFrame, erase from table, used=false.
  // If load, backing ReadPage. Claim frame: no, used, ref, pins=1, dirty=false, lsn=0.
  (void)no;
  (void)load;
  throw std::logic_error("TODO(4.1): Pin");
}

void Pool::Unpin(Frame* f, bool dirty) {
  // TODO(4.1): Throw if pins==0. Else pins--. If dirty, dirty=true and lsn=LogSize().
  (void)f;
  (void)dirty;
  throw std::logic_error("TODO(4.1): Unpin");
}

}  // namespace btreekv
