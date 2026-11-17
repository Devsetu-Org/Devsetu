#pragma once
#include "lex/lex.h"

namespace tinysh::lex {
Token ScanWord(Scanner& s);
Token ScanOp(Scanner& s);
}
