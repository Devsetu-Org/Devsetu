package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/devlabs/sqlq/internal/sqlq"
)

func main() {
	db := sqlq.Open()
	in := bufio.NewScanner(os.Stdin)
	fmt.Fprintln(os.Stderr, "sqlq. End a statement with ;")
	var buf strings.Builder
	for {
		fmt.Fprint(os.Stderr, "sqlq> ")
		if !in.Scan() {
			return
		}
		line := in.Text()
		buf.WriteString(line)
		buf.WriteByte('\n')
		if !strings.Contains(line, ";") {
			continue
		}
		stmt := buf.String()
		buf.Reset()
		upper := strings.ToUpper(strings.TrimSpace(stmt))
		if strings.HasPrefix(upper, "SELECT") {
			res, err := db.Query(stmt)
			if err != nil {
				fmt.Fprintln(os.Stderr, err)
				continue
			}
			fmt.Println(sqlq.Format(res))
			continue
		}
		if err := db.Exec(stmt); err != nil {
			fmt.Fprintln(os.Stderr, err)
		}
	}
}
