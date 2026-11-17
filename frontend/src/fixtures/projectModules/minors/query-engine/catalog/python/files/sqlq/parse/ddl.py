"""CREATE / INSERT parsing — chapter 3 student work."""

from __future__ import annotations

from sqlq.lex import token as T
from sqlq.parse.ast import Column, CreateTable, Insert, TypeInt, TypeText
from sqlq.parse.expr import parse_primary


def parse_create(p) -> CreateTable:
    # TODO(3.1) — parse_create
    raise NotImplementedError("TODO(3.1)")


def parse_type(p):
    # TODO(3.1) — parse_type
    raise NotImplementedError("TODO(3.1)")


def parse_insert(p) -> Insert:
    # TODO(3.1) — parse_insert
    raise NotImplementedError("TODO(3.1)")
