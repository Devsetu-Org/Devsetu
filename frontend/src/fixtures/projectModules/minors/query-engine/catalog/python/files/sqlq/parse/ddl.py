"""CREATE / INSERT parsing — chapter 3 student work."""

from __future__ import annotations

from sqlq.lex import token as T
from sqlq.parse.ast import Column, CreateTable, Insert, TypeInt, TypeText
from sqlq.parse.expr import parse_primary


def parse_create(p) -> CreateTable:
    # TODO(3.1): CREATE TABLE ident '(' col type {',' col type} ')'.
    # Types come from parse_type.
    raise NotImplementedError("TODO(3.1): parse_create")


def parse_type(p):
    # TODO(3.1): KwInt -> TypeInt, KwText -> TypeText, else an error.
    raise NotImplementedError("TODO(3.1): parse_type")


def parse_insert(p) -> Insert:
    # TODO(3.1): INSERT INTO ident VALUES, then one or more parenthesized lists of primaries.
    raise NotImplementedError("TODO(3.1): parse_insert")
