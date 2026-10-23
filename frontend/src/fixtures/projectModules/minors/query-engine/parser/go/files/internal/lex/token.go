// Package lex turns SQL text into tokens. The parser never sees raw characters.
package lex

import "strings"

// Kind is one token class.
type Kind int

const (
	Illegal Kind = iota
	EOF
	Ident
	Int
	String
	Star
	Comma
	LParen
	RParen
	Eq
	Lt
	Gt
	Semicolon
	Dot
	KwSelect
	KwFrom
	KwWhere
	KwCreate
	KwTable
	KwInsert
	KwInto
	KwValues
	KwInt
	KwText
	KwAnd
	KwJoin
	KwInner
	KwOn
	KwGroup
	KwBy
	KwOrder
	KwLimit
	KwAsc
	KwDesc
	KwCount
	KwSum
	KwAs
)

func (k Kind) String() string {
	if int(k) >= 0 && int(k) < len(kindNames) {
		return kindNames[k]
	}
	return "illegal"
}

var kindNames = []string{
	"illegal", "eof", "ident", "int", "string",
	"star", "comma", "lparen", "rparen", "eq", "lt", "gt", "semicolon", "dot",
	"select", "from", "where", "create", "table", "insert", "into", "values",
	"intkw", "text", "and", "join", "inner", "on", "group", "by", "order",
	"limit", "asc", "desc", "count", "sum", "as",
}

var keywords = map[string]Kind{
	"select": KwSelect,
	"from":   KwFrom,
	"where":  KwWhere,
	"create": KwCreate,
	"table":  KwTable,
	"insert": KwInsert,
	"into":   KwInto,
	"values": KwValues,
	"int":    KwInt,
	"text":   KwText,
	"and":    KwAnd,
	"join":   KwJoin,
	"inner":  KwInner,
	"on":     KwOn,
	"group":  KwGroup,
	"by":     KwBy,
	"order":  KwOrder,
	"limit":  KwLimit,
	"asc":    KwAsc,
	"desc":   KwDesc,
	"count":  KwCount,
	"sum":    KwSum,
	"as":     KwAs,
}

// Keyword returns the keyword kind for a lower-cased word, or Ident.
func Keyword(lit string) Kind {
	if k, ok := keywords[strings.ToLower(lit)]; ok {
		return k
	}
	return Ident
}

// Token is one lexeme. Lit is the identifier, the integer digits, or the
// string contents without quotes.
type Token struct {
	Kind Kind
	Lit  string
	Pos  int
}

// Error is a scan failure at a byte offset.
type Error struct {
	Pos int
	Msg string
}

func (e *Error) Error() string { return e.Msg }
