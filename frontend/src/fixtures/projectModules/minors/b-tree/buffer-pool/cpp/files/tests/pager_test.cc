#include "pager/pager.h"

#include "check.h"

#include <fcntl.h>
#include <unistd.h>

#include <cstdio>
#include <cstring>
#include <fstream>
#include <string>
#include <vector>

using namespace btreekv;

namespace {

std::string TmpPath() {
  char tmpl[] = "/tmp/btreekv-pager-XXXXXX";
  int fd = mkstemp(tmpl);
  CHECK(fd >= 0);
  ::close(fd);
  ::unlink(tmpl);
  return std::string(tmpl) + ".db";
}

std::vector<uint8_t> Page(uint8_t b) {
  std::vector<uint8_t> buf(kPageSize, 0);
  for (uint32_t i = 0; i < kUsable; ++i) buf[i] = b;
  return buf;
}

}  // namespace

TEST(WriteThenRead) {
  std::string path = TmpPath();
  {
    Pager p = Pager::Open(path);
    for (PageNo i = 1; i <= 3; ++i) {
      auto pg = Page(static_cast<uint8_t>(i));
      p.WritePage(i, pg.data(), pg.size());
    }
    for (PageNo i = 1; i <= 3; ++i) {
      std::vector<uint8_t> got(kPageSize);
      p.ReadPage(i, got.data(), got.size());
      auto want = Page(static_cast<uint8_t>(i));
      CHECK(std::memcmp(got.data(), want.data(), kUsable) == 0);
    }
    p.Close();
  }
  ::unlink(path.c_str());
}

TEST(PageTrailerIsCRC32C) {
  std::string path = TmpPath();
  {
    Pager p = Pager::Open(path);
    auto pg = Page(0xAB);
    p.WritePage(2, pg.data(), pg.size());
    p.Close();
  }
  std::ifstream in(path, std::ios::binary);
  std::vector<uint8_t> raw((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
  CHECK(raw.size() >= 3 * kPageSize);
  const uint8_t* page = raw.data() + 2 * kPageSize;
  uint32_t want = Crc32c(page, kUsable);
  uint32_t got = uint32_t(page[kUsable]) | (uint32_t(page[kUsable + 1]) << 8) |
                 (uint32_t(page[kUsable + 2]) << 16) | (uint32_t(page[kUsable + 3]) << 24);
  CHECK(got == want);
  ::unlink(path.c_str());
}

TEST(WriteLeavesCallerBufferAlone) {
  std::string path = TmpPath();
  Pager p = Pager::Open(path);
  auto buf = Page(7);
  for (uint32_t i = kUsable; i < kPageSize; ++i) buf[i] = 0xEE;
  p.WritePage(1, buf.data(), buf.size());
  for (uint32_t i = kUsable; i < kPageSize; ++i) CHECK(buf[i] == 0xEE);
  p.Close();
  ::unlink(path.c_str());
}

TEST(CorruptionIsDetected) {
  std::string path = TmpPath();
  Pager p = Pager::Open(path);
  auto pg = Page(1);
  p.WritePage(1, pg.data(), pg.size());
  int fd = ::open(path.c_str(), O_RDWR);
  CHECK(fd >= 0);
  uint8_t ff = 0xFF;
  ::pwrite(fd, &ff, 1, kPageSize + 100);
  ::close(fd);
  std::vector<uint8_t> buf(kPageSize);
  bool threw = false;
  try {
    p.ReadPage(1, buf.data(), buf.size());
  } catch (const ChecksumError&) {
    threw = true;
  }
  CHECK(threw);
  p.Close();
  ::unlink(path.c_str());
}

TEST(BadBufferAndPastEnd) {
  std::string path = TmpPath();
  Pager p = Pager::Open(path);
  std::vector<uint8_t> short_buf(100);
  bool bad_write = false, bad_read = false, past = false;
  try {
    p.WritePage(1, short_buf.data(), short_buf.size());
  } catch (const BadPageError&) {
    bad_write = true;
  }
  try {
    p.ReadPage(1, short_buf.data(), short_buf.size());
  } catch (const BadPageError&) {
    bad_read = true;
  }
  std::vector<uint8_t> full(kPageSize);
  try {
    p.ReadPage(500, full.data(), full.size());
  } catch (const BadPageError&) {
    past = true;
  }
  CHECK(bad_write && bad_read && past);
  p.Close();
  ::unlink(path.c_str());
}

TEST(AllocateGrowsTheFile) {
  std::string path = TmpPath();
  Pager p = Pager::Open(path);
  for (PageNo want = 1; want <= 4; ++want) {
    CHECK(p.Allocate() == want);
  }
  CHECK(p.meta().page_count == 5);
  std::vector<uint8_t> buf(kPageSize);
  p.ReadPage(4, buf.data(), buf.size());
  p.Close();
  ::unlink(path.c_str());
}

TEST(FreeThenAllocateReuses) {
  std::string path = TmpPath();
  Pager p = Pager::Open(path);
  PageNo nos[3];
  for (int i = 0; i < 3; ++i) nos[i] = p.Allocate();
  p.Free(nos[1]);
  p.Free(nos[2]);
  PageNo wants[3] = {nos[2], nos[1], 4};
  for (PageNo want : wants) CHECK(p.Allocate() == want);
  Meta m = p.meta();
  CHECK(m.page_count == 5);
  CHECK(m.free_head == 0);
  p.Close();
  ::unlink(path.c_str());
}

TEST(FreeRejectsBadPages) {
  std::string path = TmpPath();
  Pager p = Pager::Open(path);
  p.Allocate();
  for (PageNo no : {PageNo(0), PageNo(9)}) {
    bool threw = false;
    try {
      p.Free(no);
    } catch (const BadPageError&) {
      threw = true;
    }
    CHECK(threw);
  }
  p.Close();
  ::unlink(path.c_str());
}

TEST(StateSurvivesReopen) {
  std::string path = TmpPath();
  PageNo a, b, c;
  {
    Pager p = Pager::Open(path);
    a = p.Allocate();
    b = p.Allocate();
    c = p.Allocate();
    auto pg = Page(9);
    p.WritePage(c, pg.data(), pg.size());
    p.Free(b);
    p.SetRoot(a);
    p.Close();
  }
  {
    Pager p = Pager::Open(path);
    CHECK(p.Root() == a);
    std::vector<uint8_t> got(kPageSize);
    p.ReadPage(c, got.data(), got.size());
    CHECK(got[0] == 9);
    CHECK(p.Allocate() == b);
    CHECK(p.Allocate() == 4);
    p.Close();
  }
  ::unlink(path.c_str());
}

TEST(OpenRejectsAForeignFile) {
  std::string path = TmpPath();
  {
    std::ofstream out(path, std::ios::binary);
    std::string junk(kPageSize, 'x');
    out.write(junk.data(), junk.size());
  }
  bool threw = false;
  try {
    Pager p = Pager::Open(path);
    p.Close();
  } catch (...) {
    threw = true;
  }
  CHECK(threw);
  ::unlink(path.c_str());
}

TEST(OpenRejectsACorruptHeader) {
  std::string path = TmpPath();
  {
    Pager p = Pager::Open(path);
    p.Close();
  }
  int fd = ::open(path.c_str(), O_RDWR);
  CHECK(fd >= 0);
  uint8_t b = 0x55;
  ::pwrite(fd, &b, 1, 3);
  ::close(fd);
  bool threw = false;
  try {
    Pager p = Pager::Open(path);
    p.Close();
  } catch (const ChecksumError&) {
    threw = true;
  }
  CHECK(threw);
  ::unlink(path.c_str());
}

int main() { return check::RunAll(); }
