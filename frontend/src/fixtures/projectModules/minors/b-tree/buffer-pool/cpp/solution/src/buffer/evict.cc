#include "buffer/pool.h"

namespace btreekv {

int Pool::Victim() {
  int n = int(frames_.size());
  for (int step = 0; step < 2 * n; ++step) {
    int i = hand_;
    hand_ = (hand_ + 1) % n;
    Frame& f = frames_[size_t(i)];
    if (!f.used) return i;
    if (f.pins > 0) continue;
    if (f.ref) {
      f.ref = false;
      continue;
    }
    return i;
  }
  throw PoolFullError("buffer: every frame is pinned");
}

}  // namespace btreekv
