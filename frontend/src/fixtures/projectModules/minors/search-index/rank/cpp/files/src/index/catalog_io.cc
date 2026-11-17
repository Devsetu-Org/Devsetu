#include "index/catalog_io.h"

#include "postings/segment.h"

#include <algorithm>
#include <cstring>
#include <fstream>
#include <sstream>
#include <stdexcept>

namespace findx {
namespace index {
namespace {

std::string Escape(const std::string& s) {
  std::string out;
  for (char c : s) {
    if (c == '"' || c == '\\') out.push_back('\\');
    out.push_back(c);
  }
  return out;
}

// Minimal extractor for our fixed catalog shape.
std::string ExtractString(const std::string& json, size_t* i) {
  while (*i < json.size() && json[*i] != '"') ++(*i);
  if (*i >= json.size()) throw std::runtime_error("catalog: bad string");
  ++(*i);
  std::string out;
  while (*i < json.size() && json[*i] != '"') {
    if (json[*i] == '\\' && *i + 1 < json.size()) {
      ++(*i);
      out.push_back(json[*i]);
    } else {
      out.push_back(json[*i]);
    }
    ++(*i);
  }
  if (*i < json.size()) ++(*i);
  return out;
}

long ExtractNumber(const std::string& json, size_t* i) {
  while (*i < json.size() && (json[*i] == ' ' || json[*i] == ':' || json[*i] == ',' ||
                              json[*i] == '\n' || json[*i] == '\r' || json[*i] == '\t'))
    ++(*i);
  size_t start = *i;
  if (*i < json.size() && json[*i] == '-') ++(*i);
  while (*i < json.size() && json[*i] >= '0' && json[*i] <= '9') ++(*i);
  return std::stol(json.substr(start, *i - start));
}

}  // namespace

void WriteCatalogFile(const Engine& e) {
  std::vector<uint32_t> ids;
  ids.reserve(e.docs.size());
  for (const auto& kv : e.docs) ids.push_back(kv.first);
  std::sort(ids.begin(), ids.end());

  std::ostringstream out;
  out << "{\n  \"next_doc\": " << e.next_doc << ",\n  \"docs\": [\n";
  for (size_t i = 0; i < ids.size(); ++i) {
    const Meta& m = e.docs.at(ids[i]);
    out << "    {\"id\": " << ids[i] << ", \"ext_id\": \"" << Escape(m.ext_id)
        << "\", \"len\": " << m.length << "}";
    if (i + 1 < ids.size()) out << ",";
    out << "\n";
  }
  out << "  ],\n  \"segments\": [\n";
  for (size_t i = 0; i < e.seg_names.size(); ++i) {
    out << "    \"" << Escape(e.seg_names[i]) << "\"";
    if (i + 1 < e.seg_names.size()) out << ",";
    out << "\n";
  }
  out << "  ]\n}\n";

  std::ofstream f(e.dir + "/" + CatalogName());
  f << out.str();
}

void Engine::WriteCatalog() const { WriteCatalogFile(*this); }

void LoadCatalog(Engine* e, const std::string& path) {
  std::ifstream in(path);
  std::stringstream buf;
  buf << in.rdbuf();
  std::string json = buf.str();
  size_t i = 0;
  auto find_key = [&](const char* key) {
    auto pos = json.find(key, i);
    if (pos == std::string::npos) throw std::runtime_error("catalog: missing key");
    i = pos + std::strlen(key);
  };
  find_key("\"next_doc\"");
  e->next_doc = static_cast<uint32_t>(ExtractNumber(json, &i));
  find_key("\"docs\"");
  while (i < json.size() && json[i] != '[') ++i;
  if (i < json.size()) ++i;
  while (i < json.size()) {
    while (i < json.size() && json[i] != '{' && json[i] != ']') ++i;
    if (i >= json.size() || json[i] == ']') break;
    ++i;
    find_key("\"id\"");
    uint32_t id = static_cast<uint32_t>(ExtractNumber(json, &i));
    find_key("\"ext_id\"");
    std::string ext = ExtractString(json, &i);
    find_key("\"len\"");
    int len = static_cast<int>(ExtractNumber(json, &i));
    e->docs[id] = Meta{ext, len};
    e->ext_to_id[ext] = id;
    while (i < json.size() && json[i] != '}') ++i;
    if (i < json.size()) ++i;
  }
  find_key("\"segments\"");
  while (i < json.size() && json[i] != '[') ++i;
  if (i < json.size()) ++i;
  while (i < json.size()) {
    while (i < json.size() && json[i] != '"' && json[i] != ']') ++i;
    if (i >= json.size() || json[i] == ']') break;
    std::string name = ExtractString(json, &i);
    auto seg = postings::OpenSegment(e->dir + "/" + name);
    e->seg_names.push_back(name);
    e->segs.push_back(std::move(seg));
  }
}

}  // namespace index
}  // namespace findx
