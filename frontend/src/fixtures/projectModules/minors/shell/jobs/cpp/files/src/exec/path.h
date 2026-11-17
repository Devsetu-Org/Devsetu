#pragma once
#include <string>
#include <vector>
#include <stdexcept>

namespace tinysh::exe {

struct NotFound : std::runtime_error {
  NotFound() : std::runtime_error("command not found") {}
};

std::string LookPath(const std::string& name, const std::string& dir,
                     const std::vector<std::string>& env);
std::string EnvGet(const std::vector<std::string>& env, const std::string& key);

}  // namespace tinysh::exe
