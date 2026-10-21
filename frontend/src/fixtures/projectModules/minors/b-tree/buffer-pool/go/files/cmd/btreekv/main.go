// Command btreekv is a REPL over the engine as it grows. From chapter 2 on it
// keeps its data in a directory, so quitting (or killing it) keeps what the
// current chapter promises to keep.
package main

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/devlabs/btreekv/internal/db"
)

const help = `commands:
  put <key> <value>        store a value
  get <key>                look a key up
  del <key>                delete a key
  scan [start [end]]       list keys in [start, end)
  stats                    shape of the tree and the file
  quit`

func main() {
	dir := flag.String("dir", "data", "data directory")
	flag.Parse()

	d, err := db.Open(*dir, db.Options{})
	if err != nil {
		fmt.Fprintln(os.Stderr, "open:", err)
		os.Exit(1)
	}
	defer d.Close()

	s, err := d.Stats()
	if err != nil {
		fmt.Fprintln(os.Stderr, "open:", err)
		os.Exit(1)
	}
	fmt.Printf("btreekv: dir=%s, %d keys, height %d. Type 'help'.\n", *dir, s.Keys, s.Height)

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
		switch cmd, args := strings.ToLower(fields[0]), fields[1:]; {
		case cmd == "put" && len(args) >= 2:
			report(d.Put([]byte(args[0]), []byte(strings.Join(args[1:], " "))))
		case cmd == "get" && len(args) == 1:
			value, ok, err := d.Get([]byte(args[0]))
			switch {
			case err != nil:
				fmt.Println("error:", err)
			case ok:
				fmt.Printf("%q\n", value)
			default:
				fmt.Println("(not found)")
			}
		case cmd == "del" && len(args) == 1:
			report(d.Delete([]byte(args[0])))
		case cmd == "scan" && len(args) <= 2:
			var start, end []byte
			if len(args) > 0 {
				start = []byte(args[0])
			}
			if len(args) > 1 {
				end = []byte(args[1])
			}
			err := d.Scan(start, end, func(k, v []byte) bool {
				fmt.Printf("%s  %q\n", k, v)
				return true
			})
			if err != nil {
				fmt.Println("error:", err)
			}
		case cmd == "stats":
			s, err := d.Stats()
			if err != nil {
				fmt.Println("error:", err)
				continue
			}
			fmt.Printf("keys=%d height=%d leaves=%d internal=%d  pages=%d free=%d  wal bytes=%d  pool resident=%d dirty=%d\n",
				s.Keys, s.Height, s.Leaves, s.Internal, s.Pages, s.FreePages, s.WALBytes, s.Resident, s.Dirty)
		case cmd == "quit" || cmd == "exit":
			return
		default:
			fmt.Println(help)
		}
	}
}

func report(err error) {
	if err != nil {
		fmt.Println("error:", err)
	} else {
		fmt.Println("OK")
	}
}
