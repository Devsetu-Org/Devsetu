"""CREATE / INSERT parsing — chapter 3 student work."""

from __future__ import annotations

from sqlq.lex import token as T
from sqlq.parse.ast import Column, CreateTable, Insert, TypeInt, TypeText
from sqlq.parse.expr import parse_primary


def parse_create(p) -> CreateTable:
    p.expect(T.KwCreate)
    p.expect(T.KwTable)
    name = p.expect(T.Ident)
    p.expect(T.LParen)
    ct = CreateTable(name=name.lit)
    while True:
        col = p.expect(T.Ident)
        typ = parse_type(p)
        ct.cols.append(Column(name=col.lit, type=typ))
        if p.eat(T.Comma):
            continue
        break
    p.expect(T.RParen)
    return ct


def parse_type(p):
    if p.eat(T.KwInt):
        return TypeInt
    if p.eat(T.KwText):
        return TypeText
    raise p.errorf("expected INT or TEXT")


def parse_insert(p) -> Insert:
    p.expect(T.KwInsert)
    p.expect(T.KwInto)
    name = p.expect(T.Ident)
    p.expect(T.KwValues)
    ins = Insert(table=name.lit)
    while True:
        p.expect(T.LParen)
        row = []
        while True:
            row.append(parse_primary(p))
            if p.eat(T.Comma):
                continue
            break
        p.expect(T.RParen)
        ins.rows.append(row)
        if p.eat(T.Comma):
            continue
        break
    return ins
