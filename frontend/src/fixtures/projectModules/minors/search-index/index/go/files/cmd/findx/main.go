package main

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/devlabs/findx/internal/findx"
)

func main() {
	dir := filepath.Join(".", "findx-data")
	if v := os.Getenv("FINDX_DIR"); v != "" {
		dir = v
	}
	idx, err := findx.Open(dir)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Fprintf(os.Stderr, "findx. dir=%s  commands: add <id> <text> | flush\n", dir)
	in := bufio.NewScanner(os.Stdin)
	for {
		fmt.Fprint(os.Stderr, "findx> ")
		if !in.Scan() {
			return
		}
		line := strings.TrimSpace(in.Text())
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, " ", 2)
		switch parts[0] {
		case "add":
			if len(parts) < 2 {
				fmt.Fprintln(os.Stderr, "usage: add <id> <text>")
				continue
			}
			rest := strings.SplitN(parts[1], " ", 2)
			if len(rest) < 2 {
				fmt.Fprintln(os.Stderr, "usage: add <id> <text>")
				continue
			}
			if err := idx.Add(rest[0], rest[1]); err != nil {
				fmt.Fprintln(os.Stderr, err)
			}
		case "flush":
			if err := idx.Flush(); err != nil {
				fmt.Fprintln(os.Stderr, err)
			}
		default:
			fmt.Fprintln(os.Stderr, "unknown command")
		}
	}
}
