#pragma once
#include "parse/parse.h"
namespace tinysh::parse {
ast::Redir ParseRedir(Parser& p);
}
