#include <cstdint>
#include <cstdio>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <string>
#include <vector>

#include "check.h"
#include "wal/reader.h"
#include "wal/record.h"
#include "wal/writer.h"

namespace fs = std::filesystem;
using lsmkv::Kind;
using lsmkv::wal::Create;
using lsmkv::wal::Encode;
using lsmkv::wal::kHeaderSize;
using lsmkv::wal::OpenAppend;
using lsmkv::wal::Record;
using lsmkv::wal::Replay;
using lsmkv::wal::SyncMode;
using lsmkv::wal::Writer;

namespace {

Record Put(const std::string& k, const std::string& v) {
  Record r;
  r.kind = Kind::kValue;
  r.key = k;
  r.value = v;
  return r;
}

Record Del(const std::string& k) {
  Record r;
  r.kind = Kind::kTombstone;
  r.key = k;
  return r;
}

void WriteLog(const std::string& path, const std::vector<Record>& recs) {
  Writer* w = Create(path, SyncMode::kNever);
  for (const Record& r : recs) w->Append(r);
  w->Close();
  delete w;
}

std::pair<std::vector<Record>, int64_t> ReplayAll(const std::string& path) {
  std::vector<Record> got;
  int64_t good = Replay(path, [&](const Record& r) {
    Record copy = r;
    got.push_back(std::move(copy));
  });
  return {got, good};
}

void SameRecords(const std::vector<Record>& got, const std::vector<Record>& want) {
  CHECK_EQ(got.size(), want.size());
  for (size_t i = 0; i < want.size(); ++i) {
    CHECK(got[i].kind == want[i].kind);
    CHECK_EQ(got[i].key, want[i].key);
    CHECK_EQ(got[i].value, want[i].value);
  }
}

uint32_t ReadU32(const char* p) {
  return uint32_t(uint8_t(p[0])) | (uint32_t(uint8_t(p[1])) << 8) |
         (uint32_t(uint8_t(p[2])) << 16) | (uint32_t(uint8_t(p[3])) << 24);
}

std::string TmpDir() {
  auto p = fs::temp_directory_path() / ("lsmkv-wal-" + std::to_string(rand()));
  fs::create_directories(p);
  return p.string();
}

}  // namespace

TEST(EncodeLayout) {
  std::string b;
  Encode(&b, Put("k", "vv"));
  CHECK_EQ(b.size(), kHeaderSize + 6);
  CHECK_EQ(ReadU32(b.data() + 4), 6u);
  const std::string want_payload({char(1), 1, 'k', 2, 'v', 'v'});
  CHECK_EQ(b.substr(kHeaderSize), want_payload);
  CHECK(ReadU32(b.data()) != 0);
  std::string prefix = "keep";
  Encode(&prefix, Put("k", "vv"));
  CHECK_EQ(prefix.substr(0, 4), std::string("keep"));
  CHECK_EQ(prefix.substr(4), b);
}

TEST(RoundTrip) {
  std::string dir = TmpDir();
  std::string path = dir + "/wal.log";
  std::vector<Record> want = {
      Put("order:1", "pending"),
      Put("order:2", ""),
      Del("order:1"),
      Put(std::string("bin\0key", 7), std::string("\xff\x00\x01", 3)),
      Put("big", std::string(100000, 'x')),
  };
  WriteLog(path, want);
  auto [got, good] = ReplayAll(path);
  SameRecords(got, want);
  CHECK_EQ(good, static_cast<int64_t>(fs::file_size(path)));
  fs::remove_all(dir);
}

TEST(MissingFileIsEmpty) {
  auto [got, good] = ReplayAll(TmpDir() + "/nope.log");
  CHECK_EQ(got.size(), size_t{0});
  CHECK_EQ(good, int64_t{0});
}

TEST(AppendIsNotBuffered) {
  std::string dir = TmpDir();
  std::string path = dir + "/wal.log";
  Writer* w = Create(path, SyncMode::kNever);
  w->Append(Put("a", "1"));
  auto [got, _] = ReplayAll(path);
  SameRecords(got, {Put("a", "1")});
  std::string encoded;
  Encode(&encoded, Put("a", "1"));
  CHECK_EQ(w->Size(), static_cast<int64_t>(encoded.size()));
  w->Close();
  delete w;
  fs::remove_all(dir);
}

TEST(TornTailAtEveryByte) {
  std::string dir = TmpDir();
  std::string path = dir + "/wal.log";
  std::vector<Record> first = {Put("a", "1"), Del("b")};
  Record last = Put("c", "the last write, cut short");
  std::vector<Record> all = first;
  all.push_back(last);
  WriteLog(path, all);
  std::string full;
  {
    std::ifstream in(path, std::ios::binary);
    full.assign((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
  }
  std::string encoded_last;
  Encode(&encoded_last, last);
  const int64_t keep = static_cast<int64_t>(full.size() - encoded_last.size());
  for (size_t cut = 1; cut < encoded_last.size(); ++cut) {
    std::string torn = dir + "/torn-" + std::to_string(cut) + ".log";
    {
      std::ofstream out(torn, std::ios::binary);
      out.write(full.data(), static_cast<std::streamsize>(full.size() - cut));
    }
    auto [got, good] = ReplayAll(torn);
    CHECK_EQ(got.size(), first.size());
    SameRecords(got, first);
    CHECK_EQ(good, keep);
  }
  fs::remove_all(dir);
}

TEST(ChecksumMismatchStopsReplay) {
  std::string dir = TmpDir();
  std::string path = dir + "/wal.log";
  WriteLog(path, {Put("a", "1"), Put("b", "2"), Put("c", "3")});
  std::string data;
  {
    std::ifstream in(path, std::ios::binary);
    data.assign((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
  }
  data.back() ^= static_cast<char>(0xff);
  {
    std::ofstream out(path, std::ios::binary);
    out.write(data.data(), static_cast<std::streamsize>(data.size()));
  }
  auto [got, _] = ReplayAll(path);
  SameRecords(got, {Put("a", "1"), Put("b", "2")});
  fs::remove_all(dir);
}

TEST(HugeLengthIsATornTail) {
  std::string dir = TmpDir();
  std::string path = dir + "/wal.log";
  WriteLog(path, {Put("a", "1")});
  std::string data;
  {
    std::ifstream in(path, std::ios::binary);
    data.assign((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
  }
  char garbage[kHeaderSize] = {};
  garbage[4] = static_cast<char>(0xf0);
  garbage[5] = static_cast<char>(0xff);
  garbage[6] = static_cast<char>(0xff);
  garbage[7] = static_cast<char>(0xff);
  {
    std::ofstream out(path, std::ios::binary);
    out.write(data.data(), static_cast<std::streamsize>(data.size()));
    out.write(garbage, kHeaderSize);
  }
  auto [got, good] = ReplayAll(path);
  SameRecords(got, {Put("a", "1")});
  CHECK_EQ(good, static_cast<int64_t>(data.size()));
  fs::remove_all(dir);
}

TEST(ReplayStopsOnCallbackError) {
  std::string dir = TmpDir();
  std::string path = dir + "/wal.log";
  WriteLog(path, {Put("a", "1"), Put("b", "2")});
  int calls = 0;
  try {
    Replay(path, [&](const Record&) {
      ++calls;
      throw std::runtime_error("boom");
    });
    CHECK(false);
  } catch (const std::runtime_error& e) {
    CHECK_EQ(std::string(e.what()), std::string("boom"));
  }
  CHECK_EQ(calls, 1);
  fs::remove_all(dir);
}

int main() { return check::RunAll(); }
