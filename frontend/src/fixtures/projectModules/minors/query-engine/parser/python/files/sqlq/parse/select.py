"""SELECT parsing — chapter 2 student work."""

from __future__ import annotations

from sqlq.lex import token as T
from sqlq.parse.ast import Select, SelectItem
from sqlq.parse.expr import parse_expr


def parse_select(p) -> Select:
    # TODO(2.3): SELECT, one or more items separated by commas, FROM, a table name,
    # parse_alias, parse_from_tail, an optional WHERE expression, then finish_select.
    raise NotImplementedError("TODO(2.3): parse_select")


def parse_select_item(p) -> SelectItem:
    # TODO(2.3): '*' is SelectItem(star=True). Otherwise an expression, then an optional AS name.
    raise NotImplementedError("TODO(2.3): parse_select_item")


def parse_alias(p) -> str:
    # TODO(2.3): AS ident, or a bare ident, or "".
    raise NotImplementedError("TODO(2.3): parse_alias")
