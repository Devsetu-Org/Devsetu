"""SELECT parsing — chapter 2 student work."""

from __future__ import annotations

from sqlq.lex import token as T
from sqlq.parse.ast import Select, SelectItem
from sqlq.parse.expr import parse_expr


def parse_select(p) -> Select:
    p.expect(T.KwSelect)
    sel = Select()
    while True:
        sel.items.append(parse_select_item(p))
        if not p.eat(T.Comma):
            break
    p.expect(T.KwFrom)
    name = p.expect(T.Ident)
    sel.from_table = name.lit
    sel.alias = parse_alias(p)
    p.parse_from_tail(sel)
    if p.eat(T.KwWhere):
        sel.where = parse_expr(p)
    p.finish_select(sel)
    return sel


def parse_select_item(p) -> SelectItem:
    if p.eat(T.Star):
        return SelectItem(star=True)
    e = parse_expr(p)
    item = SelectItem(expr=e)
    if p.eat(T.KwAs):
        a = p.expect(T.Ident)
        item.alias = a.lit
    return item


def parse_alias(p) -> str:
    if p.eat(T.KwAs):
        a = p.expect(T.Ident)
        return a.lit
    if p.at(T.Ident):
        a = p.expect(T.Ident)
        return a.lit
    return ""
