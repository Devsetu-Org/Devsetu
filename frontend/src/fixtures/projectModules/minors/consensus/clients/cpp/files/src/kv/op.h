#pragma once
#include <cstdint>
#include <string>
namespace kv {
enum class OpKind : uint8_t { Get = 1, Put = 2, Delete = 3 };
struct Op { OpKind kind; std::string key, value; int64_t client_id=0, seq=0; };
struct Result { std::string value; bool found=false; };
inline constexpr const char* kErrNotLeader = "not leader";
inline constexpr const char* kErrTimeout = "timeout";
struct ExecuteArgs { Op op; };
struct ExecuteReply { std::string err; std::string value; bool found=false; int leader=-1; };
std::string EncodeOp(const Op& op);
Op DecodeOp(const std::string& data);
}  // namespace kv
