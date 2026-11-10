#include "wal/record.h"
#include "wal/writer.h"
#include "wal/reader.h"
#include "check.h"

#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <memory>
#include <unistd.h>
#include <vector>

using namespace btreekv;

static std::string TmpDir() {
  auto p = std::filesystem::temp_directory_path() /
           ("btreekv-wal-" + std::to_string(::getpid()) + "-" + std::to_string(rand()));
  std::filesystem::create_directories(p);
  return p.string();
}

static Record PageRec(uint32_t no, uint8_t fill) {
  Record r;
  r.kind = WalKind::kPage;
  r.page = no;
  r.data.assign(kUsable, char(fill));
  return r;
}

static uint32_t GetLE32(const uint8_t* p) {
  return uint32_t(p[0]) | (uint32_t(p[1]) << 8) | (uint32_t(p[2]) << 16) | (uint32_t(p[3]) << 24);
}

TEST(EncodeFrame) {
  Record r;
  r.kind = WalKind::kPage;
  r.page = 9;
  r.data = "hello";
  std::vector<uint8_t> out(reinterpret_cast<const uint8_t*>("keep-me"),
                           reinterpret_cast<const uint8_t*>("keep-me") + 7);
  Encode(&out, r);
  CHECK(out.size() >= 7);
  CHECK(std::string(out.begin(), out.begin() + 7) == "keep-me");
  std::vector<uint8_t> payload;
  AppendPayload(&payload, r);
  CHECK(out.size() == 7 + kWalHeaderSize + payload.size());
  const uint8_t* frame = out.data() + 7;
  CHECK(GetLE32(frame) == Crc32c(payload.data(), payload.size()));
  CHECK(GetLE32(frame + 4) == uint32_t(payload.size()));
  CHECK(std::equal(payload.begin(), payload.end(), frame + kWalHeaderSize));
}

TEST(AppendReplayRoundTrip) {
  std::string dir = TmpDir();
  std::string path = dir + "/wal.log";
  std::unique_ptr<Writer> w(Create(path, SyncMode::kNever));
  w->Append({PageRec(1, 'a'), MetaRecord(1, 2, 0), CommitRecord()});
  w->Append({PageRec(2, 'b'), CommitRecord()});
  int64_t size = w->Size();
  w->Close();

  std::vector<Record> recs;
  std::vector<int64_t> ends;
  int64_t good = Replay(path, [&](const Record& r, int64_t end) {
    recs.push_back(r);
    ends.push_back(end);
  });
  CHECK(recs.size() == 5);
  CHECK(good == size);
  CHECK(ends.back() == size);
  CHECK(recs[0].kind == WalKind::kPage && recs[0].page == 1);
  CHECK(recs[0].data == PageRec(1, 'a').data);
  uint32_t root, count, free;
  UnpackMeta(recs[1], &root, &count, &free);
  CHECK(root == 1 && count == 2 && free == 0);
  CHECK(recs[2].kind == WalKind::kCommit);
  CHECK(recs[3].page == 2);
  std::filesystem::remove_all(dir);
}

TEST(DurableTracksFsync) {
  std::string dir = TmpDir();
  std::unique_ptr<Writer> w(Create(dir + "/a.log", SyncMode::kAlways));
  w->Append({PageRec(1, 'x')});
  CHECK(w->Durable() == w->Size());
  CHECK(w->Size() > 0);
  w->Close();

  w.reset(Create(dir + "/b.log", SyncMode::kNever));
  w->Append({PageRec(1, 'x')});
  CHECK(w->Durable() == 0);
  w->Sync();
  CHECK(w->Durable() == w->Size());
  w->Close();
  std::filesystem::remove_all(dir);
}

TEST(TornTailIsIgnored) {
  std::string dir = TmpDir();
  std::string path = dir + "/wal.log";
  std::unique_ptr<Writer> w(Create(path, SyncMode::kNever));
  w->Append({PageRec(1, 1), CommitRecord()});
  int64_t good_size = w->Size();
  w->Append({PageRec(2, 2)});
  w->Close();
  {
    std::fstream f(path, std::ios::in | std::ios::out | std::ios::binary);
    f.seekg(0, std::ios::end);
    auto pos = f.tellg();
    f.seekp(pos - std::streamoff(1));
    char bad = '\xff';
    f.write(&bad, 1);
  }
  std::vector<Record> recs;
  int64_t good = Replay(path, [&](const Record& r, int64_t) { recs.push_back(r); });
  CHECK(recs.size() == 2);
  CHECK(good == good_size);
  std::filesystem::remove_all(dir);
}

int main() { return check::RunAll(); }
