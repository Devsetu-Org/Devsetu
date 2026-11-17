"""SELECT parsing — chapter 2 student work."""

from __future__ import annotations

from sqlq.lex import token as T
from sqlq.parse.ast import Select, SelectItem
from sqlq.parse.expr import parse_expr


def parse_select(p) -> Select:
    # TODO(2.3) — parse_select
    raise NotImplementedError("TODO(2.3)")


def parse_select_item(p) -> SelectItem:
    # TODO(2.3) — parse_select_item
    raise NotImplementedError("TODO(2.3)")


def parse_alias(p) -> str:
    # TODO(2.3) — parse_alias
    raise NotImplementedError("TODO(2.3)")
