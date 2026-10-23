package exec

import (
	"fmt"
	"strings"

	"github.com/devlabs/sqlq/internal/catalog"
	"github.com/devlabs/sqlq/internal/parse"
)

// Aggregate groups rows and evaluates COUNT(*) and SUM.
func Aggregate(rows []Row, items []parse.SelectItem, group []parse.Expr) ([]Row, error) {
	type acc struct {
		first Row
		count int64
		sums  map[int]int64
	}
	buckets := map[string]*acc{}
	var order []string
	for _, row := range rows {
		key, err := groupKey(row, group)
		if err != nil {
			return nil, err
		}
		b := buckets[key]
		if b == nil {
			b = &acc{first: row, sums: map[int]int64{}}
			buckets[key] = b
			order = append(order, key)
		}
		b.count++
		for i, item := range items {
			call, ok := item.Expr.(*parse.Call)
			if !ok || call.Star || call.Name != "sum" {
				continue
			}
			v, err := Eval(call.Arg, row)
			if err != nil {
				return nil, err
			}
			if v.T != catalog.TypeInt {
				return nil, fmt.Errorf("SUM needs INT")
			}
			b.sums[i] += v.I
		}
	}
	if len(rows) == 0 && len(group) == 0 {
		order = []string{""}
		buckets[""] = &acc{sums: map[int]int64{}}
	}
	var out []Row
	for _, key := range order {
		b := buckets[key]
		row, err := emitGroup(b.first, b.count, b.sums, items)
		if err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, nil
}

func groupKey(row Row, group []parse.Expr) (string, error) {
	if len(group) == 0 {
		return "", nil
	}
	parts := make([]string, len(group))
	for i, e := range group {
		v, err := Eval(e, row)
		if err != nil {
			return "", err
		}
		parts[i] = v.String()
	}
	return strings.Join(parts, "\x00"), nil
}

func emitGroup(sample Row, count int64, sums map[int]int64, items []parse.SelectItem) (Row, error) {
	out := Row{}
	for i, item := range items {
		name := item.Alias
		if name == "" {
			if item.Star {
				name = "*"
			} else {
				name = parse.Name(item.Expr)
			}
		}
		var v catalog.Value
		switch call := item.Expr.(type) {
		case *parse.Call:
			if call.Star || call.Name == "count" {
				v = catalog.Int(count)
			} else {
				v = catalog.Int(sums[i])
			}
		default:
			if item.Star {
				return Row{}, fmt.Errorf("SELECT * cannot be aggregated")
			}
			ev, err := Eval(item.Expr, sample)
			if err != nil {
				return Row{}, err
			}
			v = ev
		}
		out.Cols = append(out.Cols, name)
		out.Vals = append(out.Vals, v)
	}
	return out, nil
}
