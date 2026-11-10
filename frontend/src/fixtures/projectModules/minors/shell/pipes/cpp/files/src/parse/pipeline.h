#pragma once
#include "parse/parse.h"
namespace tinysh::parse {
std::vector<ast::Cmd> SplitPipeline(Parser& p);
}
