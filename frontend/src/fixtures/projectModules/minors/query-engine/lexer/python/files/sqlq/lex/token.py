"""Token kinds and the keyword table. The parser never sees raw characters."""

from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum


class Kind(IntEnum):
    ILLEGAL = 0
    EOF = 1
    IDENT = 2
    INT = 3
    STRING = 4
    STAR = 5
    COMMA = 6
    LPAREN = 7
    RPAREN = 8
    EQ = 9
    LT = 10
    GT = 11
    SEMICOLON = 12
    DOT = 13
    KW_SELECT = 14
    KW_FROM = 15
    KW_WHERE = 16
    KW_CREATE = 17
    KW_TABLE = 18
    KW_INSERT = 19
    KW_INTO = 20
    KW_VALUES = 21
    KW_INT = 22
    KW_TEXT = 23
    KW_AND = 24
    KW_JOIN = 25
    KW_INNER = 26
    KW_ON = 27
    KW_GROUP = 28
    KW_BY = 29
    KW_ORDER = 30
    KW_LIMIT = 31
    KW_ASC = 32
    KW_DESC = 33
    KW_COUNT = 34
    KW_SUM = 35
    KW_AS = 36

    def __str__(self) -> str:
        if 0 <= int(self) < len(_KIND_NAMES):
            return _KIND_NAMES[self]
        return "illegal"


# Aliases matching the Go exported names used in theory / tests.
Illegal = Kind.ILLEGAL
EOF = Kind.EOF
Ident = Kind.IDENT
Int = Kind.INT
String = Kind.STRING
Star = Kind.STAR
Comma = Kind.COMMA
LParen = Kind.LPAREN
RParen = Kind.RPAREN
Eq = Kind.EQ
Lt = Kind.LT
Gt = Kind.GT
Semicolon = Kind.SEMICOLON
Dot = Kind.DOT
KwSelect = Kind.KW_SELECT
KwFrom = Kind.KW_FROM
KwWhere = Kind.KW_WHERE
KwCreate = Kind.KW_CREATE
KwTable = Kind.KW_TABLE
KwInsert = Kind.KW_INSERT
KwInto = Kind.KW_INTO
KwValues = Kind.KW_VALUES
KwInt = Kind.KW_INT
KwText = Kind.KW_TEXT
KwAnd = Kind.KW_AND
KwJoin = Kind.KW_JOIN
KwInner = Kind.KW_INNER
KwOn = Kind.KW_ON
KwGroup = Kind.KW_GROUP
KwBy = Kind.KW_BY
KwOrder = Kind.KW_ORDER
KwLimit = Kind.KW_LIMIT
KwAsc = Kind.KW_ASC
KwDesc = Kind.KW_DESC
KwCount = Kind.KW_COUNT
KwSum = Kind.KW_SUM
KwAs = Kind.KW_AS

_KIND_NAMES = [
    "illegal",
    "eof",
    "ident",
    "int",
    "string",
    "star",
    "comma",
    "lparen",
    "rparen",
    "eq",
    "lt",
    "gt",
    "semicolon",
    "dot",
    "select",
    "from",
    "where",
    "create",
    "table",
    "insert",
    "into",
    "values",
    "intkw",
    "text",
    "and",
    "join",
    "inner",
    "on",
    "group",
    "by",
    "order",
    "limit",
    "asc",
    "desc",
    "count",
    "sum",
    "as",
]

_KEYWORDS = {
    "select": KwSelect,
    "from": KwFrom,
    "where": KwWhere,
    "create": KwCreate,
    "table": KwTable,
    "insert": KwInsert,
    "into": KwInto,
    "values": KwValues,
    "int": KwInt,
    "text": KwText,
    "and": KwAnd,
    "join": KwJoin,
    "inner": KwInner,
    "on": KwOn,
    "group": KwGroup,
    "by": KwBy,
    "order": KwOrder,
    "limit": KwLimit,
    "asc": KwAsc,
    "desc": KwDesc,
    "count": KwCount,
    "sum": KwSum,
    "as": KwAs,
}


def keyword(lit: str) -> Kind:
    """Return the keyword kind for a lower-cased word, or Ident."""
    return _KEYWORDS.get(lit.lower(), Ident)


@dataclass
class Token:
    kind: Kind
    lit: str = ""
    pos: int = 0


class LexError(Exception):
    def __init__(self, pos: int, msg: str):
        self.pos = pos
        self.msg = msg
        super().__init__(msg)
