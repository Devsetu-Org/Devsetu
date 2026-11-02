package main

import (
	"bufio"
	"fmt"
	"io"
	"os"

	"github.com/devlabs/tinysh/internal/exec"
)

func main() {
	sh := exec.New()
	in := bufio.NewReader(os.Stdin)
	for {
		line, err := in.ReadString('\n')
		if len(line) > 0 {
			status := sh.RunLine(line)
			if sh.Exited() {
				os.Exit(sh.LastStatus())
			}
			_ = status
		}
		if err == io.EOF {
			return
		}
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
	}
}
