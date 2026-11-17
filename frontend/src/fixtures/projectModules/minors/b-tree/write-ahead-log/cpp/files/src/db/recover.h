#pragma once

#include "db/txn.h"

namespace btreekv {

class DB;

// Student: recoverLog and commit — task 3.4.
void RecoverLog(DB* d);
void Commit(DB* d, Txn* t);

}  // namespace btreekv
