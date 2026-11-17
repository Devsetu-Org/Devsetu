def op_start(c: str, nxt: str) -> bool:
    if c in "|><&":
        return True
    if c == "2":
        return nxt == ">"
    return False
