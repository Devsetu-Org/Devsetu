// Package ast holds the shell statement shapes tinysh understands.
package ast

import "github.com/devlabs/tinysh/internal/lex"

// Redir is one redirection attached to a command.
type Redir struct {
	Kind lex.Kind // RedirOut, RedirApp, RedirIn, or RedirErr
	File string
}

// Cmd is one simple command: argv plus redirections.
type Cmd struct {
	Argv   []string
	Redirs []Redir
}

// Pipeline is one or more commands connected by pipes, optionally backgrounded.
type Pipeline struct {
	Cmds       []Cmd
	Background bool
}
