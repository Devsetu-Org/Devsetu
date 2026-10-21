// Command btreekv is a REPL over the engine as it grows. In chapter 1 it talks
// to the pager directly: allocate pages, write text into them, read them back.
package main

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/devlabs/btreekv/internal/pager"
)

const help = `commands:
  alloc               allocate a page
  free <n>            free page n
  write <n> <text>    write text into page n
  read <n>            read page n back
  meta                show the header state
  quit`

func main() {
	file := flag.String("file", "data.db", "page file")
	flag.Parse()

	p, err := pager.Open(*file)
	if err != nil {
		fmt.Fprintln(os.Stderr, "open:", err)
		os.Exit(1)
	}
	defer p.Close()

	fmt.Printf("btreekv: pager (chapter 1). file=%s, %d pages. Type 'help'.\n", *file, p.Meta().PageCount)

	in := bufio.NewScanner(os.Stdin)
	for {
		fmt.Print("> ")
		if !in.Scan() {
			fmt.Println()
			return
		}
		fields := strings.Fields(in.Text())
		if len(fields) == 0 {
			continue
		}
		cmd, args := strings.ToLower(fields[0]), fields[1:]
		switch {
		case cmd == "alloc":
			no, err := p.Allocate()
			if err != nil {
				fmt.Println("error:", err)
				continue
			}
			fmt.Println("page", no)
		case cmd == "free" && len(args) == 1:
			if no, ok := pageArg(args[0]); ok {
				report(p.Free(no))
			}
		case cmd == "write" && len(args) >= 2:
			if no, ok := pageArg(args[0]); ok {
				buf := make([]byte, pager.PageSize)
				copy(buf, strings.Join(args[1:], " "))
				report(p.WritePage(no, buf))
			}
		case cmd == "read" && len(args) == 1:
			if no, ok := pageArg(args[0]); ok {
				buf := make([]byte, pager.PageSize)
				if err := p.ReadPage(no, buf); err != nil {
					fmt.Println("error:", err)
					continue
				}
				text := strings.TrimRight(string(buf[:pager.Usable]), "\x00")
				fmt.Printf("%q\n", text)
			}
		case cmd == "meta":
			m := p.Meta()
			fmt.Printf("root=%d pages=%d freelist head=%d\n", m.Root, m.PageCount, m.FreeHead)
		case cmd == "quit" || cmd == "exit":
			return
		default:
			fmt.Println(help)
		}
	}
}

func pageArg(s string) (pager.PageNo, bool) {
	n, err := strconv.ParseUint(s, 10, 32)
	if err != nil {
		fmt.Println("error: not a page number:", s)
		return 0, false
	}
	return pager.PageNo(n), true
}

func report(err error) {
	if err != nil {
		fmt.Println("error:", err)
	} else {
		fmt.Println("OK")
	}
}
