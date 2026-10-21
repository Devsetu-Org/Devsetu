// Command raftkv runs a five-server replicated key/value store in this
// process and lets you use it, break it, and watch it recover.
package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/devlabs/raftkv/internal/kv"
)

const help = `commands:
  put <key> <value>    get <key>    del <key>
  leader               which server leads right now
  cut <n>              disconnect server n (clients too)    heal   reconnect everyone
  split <a,b,..>       cut those servers off from the rest (clients still reach all)
  crash <n>            kill server n        restart <n>   boot it again
  quit`

func main() {
	c, err := kv.StartCluster(5)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer c.Shutdown()
	ck := c.NewClerk()
	fmt.Println("raftkv: 5 servers running. Type help.")

	in := bufio.NewScanner(os.Stdin)
	for fmt.Print("> "); in.Scan(); fmt.Print("> ") {
		f := strings.Fields(in.Text())
		if len(f) == 0 {
			continue
		}
		node := -1
		if len(f) > 1 {
			if n, err := strconv.Atoi(f[1]); err == nil && n >= 0 && n < c.N() {
				node = n
			}
		}
		switch f[0] {
		case "help":
			fmt.Println(help)
		case "put":
			if len(f) < 3 {
				fmt.Println("usage: put <key> <value>")
				continue
			}
			report(ck.Put([]byte(f[1]), []byte(strings.Join(f[2:], " "))))
		case "get":
			if len(f) < 2 {
				fmt.Println("usage: get <key>")
				continue
			}
			v, ok, err := ck.Get([]byte(f[1]))
			switch {
			case err != nil:
				fmt.Println("error:", err)
			case !ok:
				fmt.Println("(missing)")
			default:
				fmt.Printf("%q\n", v)
			}
		case "del":
			if len(f) < 2 {
				fmt.Println("usage: del <key>")
				continue
			}
			report(ck.Delete([]byte(f[1])))
		case "leader":
			if l, ok := c.Leader(); ok {
				fmt.Println("server", l)
			} else {
				fmt.Println("no leader")
			}
		case "cut":
			if node >= 0 {
				c.Disconnect(node)
			}
		case "split":
			if len(f) < 2 {
				fmt.Println("usage: split 0,1")
				continue
			}
			var side, rest []int
			in := map[int]bool{}
			for _, s := range strings.Split(f[1], ",") {
				if n, err := strconv.Atoi(s); err == nil && n >= 0 && n < c.N() {
					in[n] = true
					side = append(side, n)
				}
			}
			for i := 0; i < c.N(); i++ {
				if !in[i] {
					rest = append(rest, i)
				}
			}
			c.Partition(side, rest)
		case "heal":
			c.Heal()
		case "crash":
			if node >= 0 {
				c.Crash(node)
			}
		case "restart":
			if node >= 0 && c.Server(node) == nil {
				c.Restart(node)
			}
		case "quit", "exit":
			return
		default:
			fmt.Println("unknown command; try help")
		}
	}
}

func report(err error) {
	if err != nil {
		fmt.Println("error:", err)
		return
	}
	fmt.Println("ok")
}
