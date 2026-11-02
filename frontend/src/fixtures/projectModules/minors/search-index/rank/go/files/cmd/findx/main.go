package main

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/devlabs/findx/internal/analyze"
	"github.com/devlabs/findx/internal/findx"
)

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "analyze":
			in := bufio.NewScanner(os.Stdin)
			for in.Scan() {
				toks := analyze.Analyze(in.Text())
				fmt.Println(strings.Join(toks, " "))
			}
			return
		}
	}

	dir := filepath.Join(".", "findx-data")
	if v := os.Getenv("FINDX_DIR"); v != "" {
		dir = v
	}
	idx, err := findx.Open(dir)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Fprintf(os.Stderr, "findx. dir=%s  commands: add <id> <text> | flush | search <k> <query>\n", dir)
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
		case "search":
			if len(parts) < 2 {
				fmt.Fprintln(os.Stderr, "usage: search <k> <query>")
				continue
			}
			rest := strings.SplitN(parts[1], " ", 2)
			if len(rest) < 2 {
				fmt.Fprintln(os.Stderr, "usage: search <k> <query>")
				continue
			}
			k, err := strconv.Atoi(rest[0])
			if err != nil {
				fmt.Fprintln(os.Stderr, "k must be an int")
				continue
			}
			hits, err := idx.Search(rest[1], k)
			if err != nil {
				fmt.Fprintln(os.Stderr, err)
				continue
			}
			for _, h := range hits {
				fmt.Printf("%s\t%.6f\n", h.ID, h.Score)
			}
		default:
			fmt.Fprintln(os.Stderr, "unknown command")
		}
	}
}
