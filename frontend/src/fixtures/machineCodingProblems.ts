/** Machine-coding problems. One file per language, standard library only. */

export type MachineCodingLanguage = 'go' | 'python' | 'java';

export const MACHINE_CODING_LANGUAGES: MachineCodingLanguage[] = ['go', 'python', 'java'];

export const MACHINE_CODING_LANGUAGE_LABELS: Record<MachineCodingLanguage, string> = {
  go: 'Go',
  python: 'Python',
  java: 'Java',
};

export function isMachineCodingLanguage(value: unknown): value is MachineCodingLanguage {
  return value === 'go' || value === 'python' || value === 'java';
}

export interface MachineCodingFile {
  path: string;
  source: string;
}

export interface MachineCodingProblem {
  id: string;
  name: string;
  subtitle: string;
  blurb: string;
  status: 'ready' | 'planned';
  /** Left pane: description, rules, constraints. */
  brief: string;
  files: Record<MachineCodingLanguage, MachineCodingFile>;
}

const HOW_IT_RUNS = `
## How your code is run

The file in the editor is the submission. Go, Python, and Java each keep their own edits in this browser. Grading is not attached yet.

When it is, that one file is copied onto a runner that already has the Go toolchain, CPython, and a JDK. The Go module is prepared there: a module path, no \`require\` lines, and tests that compile against the standard library shipped with that toolchain. Python imports your module. Java compiles your class next to the tests. Nothing is downloaded. There is no \`go get\`, no \`pip install\`, and no Maven.

Keep the file name and the names already in the file. An import from outside the standard library fails, because the runner has no network and no third-party modules.
`;

export const MACHINE_CODING_PROBLEMS: MachineCodingProblem[] = [
  {
    id: 'menu-that-expires',
    name: 'The menu that expires',
    subtitle: 'Put, get, expire, evict',
    blurb:
      'A cache for the menu service. Entries die on a deadline, and a full cache drops the one that was used least recently.',
    status: 'ready',
    brief: `
A menu service reads the same dishes all evening. The cache in the open file holds them, drops them when they expire, and makes room when it is full.

Time is a millisecond count the caller passes in. The cache does not read the system clock.

## Rules

- \`capacity\` is at least 1. A \`ttl\` is at least 1 millisecond. Keys are non-empty.
- \`Put\` stores the value until \`now + ttl\`. Putting a key that is already there updates the value and the deadline, and that key becomes the most recently used. The size does not grow.
- An expired entry takes no slot. \`Get\` on an expired key drops it and reports a miss.
- \`Get\` on a live key returns the value and makes that key the most recently used.
- When \`Put\` adds a new key and every slot holds a live entry, the least recently used live entry is removed first.
- A miss is \`false\` in Go, \`None\` in Python, and \`null\` in Java.

## Worked case

Capacity 2.

| Call | Result | Cache, most recent last |
| --- | --- | --- |
| Put \`a\` at 0, ttl 100 | stored | a |
| Put \`b\` at 10, ttl 100 | stored | a, b |
| Get \`a\` at 20 | hit | b, a |
| Put \`c\` at 30, ttl 100 | \`b\` is evicted | a, c |
| Get \`a\` at 100 | miss, \`a\` expired at 100 | c |

## Constraints

- Standard library only.
- The cache is used by one caller at a time.
${HOW_IT_RUNS}`,
    files: {
      go: {
        path: 'menu.go',
        source: `package menu

// Cache holds menu entries until they expire or a newer entry pushes them out.
// Tests call New, Put, and Get. Use the standard library only.
type Cache struct {
	capacity int
}

// New returns a cache that holds at most capacity live entries.
func New(capacity int) *Cache {
	return &Cache{capacity: capacity}
}

// Put stores value under key until nowMs+ttlMs.
// A key that is already present is updated and becomes the most recently used.
func (c *Cache) Put(key, value string, ttlMs, nowMs int64) {
}

// Get returns the value when key is live at nowMs.
// A hit makes the entry the most recently used.
// A miss or an expired entry returns "", false, and an expired entry is dropped.
func (c *Cache) Get(key string, nowMs int64) (string, bool) {
	return "", false
}
`,
      },
      python: {
        path: 'menu.py',
        source: `class Cache:
    """Menu cache. Tests call put and get. Standard library only.

    put stores value until now_ms + ttl_ms.
    get returns the value, or None on a miss or an expiry.
    """

    def __init__(self, capacity: int) -> None:
        self.capacity = capacity

    def put(self, key: str, value: str, ttl_ms: int, now_ms: int) -> None:
        return None

    def get(self, key: str, now_ms: int):
        return None
`,
      },
      java: {
        path: 'MenuCache.java',
        source: `/** Menu cache. Tests call put and get. Standard library only. */
public class MenuCache {
    public MenuCache(int capacity) {
    }

    /** Stores value under key until nowMs + ttlMs. */
    public void put(String key, String value, long ttlMs, long nowMs) {
    }

    /** Returns the value, or null on a miss or an expiry. */
    public String get(String key, long nowMs) {
        return null;
    }
}
`,
      },
    },
  },
  {
    id: 'settle-the-lunch',
    name: 'Settle the lunch',
    subtitle: 'Shares in, payments out',
    blurb:
      'People pay shared bills. Return the payments that bring every balance back to zero, in one determined order.',
    status: 'ready',
    brief: `
A group eats together all week. Each bill has one payer and a share for each person who owes part of it, tip included. The open file turns those bills into the payments that settle the group.

Amounts are whole paise. There are no floats.

## Rules

- A bill's total is the sum of its shares. The payer paid that total.
- A person's balance is everything they paid minus every share assigned to them. Positive means the group owes them. Negative means they owe the group.
- The payer can be missing from the shares. That person ate nothing and is owed the whole bill.
- A share can be zero. Names are case-sensitive.
- Drop anyone whose balance is zero.
- Walk debtors in name order and creditors in name order. The next debtor pays the next creditor the smaller of the two remaining amounts. Emit that payment, subtract it from both, and advance a side that has reached zero.
- Every payment amount is positive. Return the payments in the order they are produced. No bills returns an empty list.

## Worked case

Ada pays 300. The shares are Ada 100, Bo 100, Cy 100.

Balances: Ada +200, Bo −100, Cy −100.

Payments, debtors Bo then Cy, creditor Ada:

- Bo pays Ada 100
- Cy pays Ada 100

A second bill: Cy pays 50, and the only share is Ada 50. Bo is back to zero. The only payment is Cy pays Ada 50.

## Constraints

- Standard library only.
- Shares are zero or more. Each bill has at least one share.
${HOW_IT_RUNS}`,
    files: {
      go: {
        path: 'settle.go',
        source: `package settle

// Bill is one payment. Shares maps a person to the paise they owe.
// The payer paid the sum of the shares and may be absent from Shares.
type Bill struct {
	Payer  string
	Shares map[string]int
}

// Payment moves Amount paise from From to To.
type Payment struct {
	From   string
	To     string
	Amount int
}

// Settle returns the payments that bring every balance back to zero,
// debtors and creditors walked in name order.
func Settle(bills []Bill) []Payment {
	return nil
}
`,
      },
      python: {
        path: 'settle.py',
        source: `class Bill:
    def __init__(self, payer: str, shares: dict[str, int]) -> None:
        self.payer = payer
        self.shares = shares


class Payment:
    def __init__(self, from_person: str, to_person: str, amount: int) -> None:
        self.from_person = from_person
        self.to_person = to_person
        self.amount = amount


def settle(bills: list[Bill]) -> list[Payment]:
    """Payments that bring every balance back to zero, in name order."""
    return []
`,
      },
      java: {
        path: 'Settle.java',
        source: `import java.util.List;
import java.util.Map;

/** Payments that bring every balance back to zero. Standard library only. */
public final class Settle {
    private Settle() {
    }

    public static final class Bill {
        public final String payer;
        public final Map<String, Integer> shares;

        public Bill(String payer, Map<String, Integer> shares) {
            this.payer = payer;
            this.shares = shares;
        }
    }

    public static final class Payment {
        public final String from;
        public final String to;
        public final int amount;

        public Payment(String from, String to, int amount) {
            this.from = from;
            this.to = to;
            this.amount = amount;
        }
    }

    public static List<Payment> settle(List<Bill> bills) {
        return List.of();
    }
}
`,
      },
    },
  },
  {
    id: 'slow-the-payment-door',
    name: 'Slow the payment door',
    subtitle: 'A token bucket per merchant',
    blurb:
      'A limiter in front of the payment API. Each merchant gets a burst, then a refill. One merchant cannot spend another’s tokens.',
    status: 'ready',
    brief: `
The payment API allows a short burst and then refills slowly. Each merchant has their own bucket. The open file is that limiter.

Time is a millisecond count the caller passes in.

## Rules

- \`burst\`, \`refill\`, and \`windowMs\` are all at least 1. Merchant names are non-empty.
- A merchant's bucket is created on the first \`Allow\` for that merchant. It starts full (\`burst\` tokens) and its clock starts at that \`nowMs\`.
- Before the decision, count whole windows since the clock:

  - \`elapsed\` is \`nowMs\` minus the clock. A \`nowMs\` before the clock counts as zero elapsed.
  - \`gained = (elapsed / windowMs) * refill\`, integer division.
  - \`tokens = min(burst, tokens + gained)\`.
  - The clock moves forward by \`(gained / refill) * windowMs\` and no further. The leftover milliseconds stay for the next call.

- If at least one token remains, consume one and allow the call. Otherwise reject it.
- Merchants do not share tokens. Two limiters do not share tokens either. A service that wants a stricter door builds a second limiter.

## Worked case

Burst 2, refill 1, window 1000. One merchant.

| nowMs | Result | Tokens after the call |
| --- | --- | --- |
| 0 | allow | 1 |
| 0 | allow | 0 |
| 0 | reject | 0 |
| 1000 | allow | 0 |
| 2500 | allow | 1 |

At 2500 the clock was still 1000, so two whole windows are gained, the bucket fills to 2, one token is spent, and the clock moves to 3000. A second merchant calling at 0 is allowed: that bucket is still full.

## Constraints

- Standard library only. Integer arithmetic. No floating point.
- The limiter is used by one caller at a time.
${HOW_IT_RUNS}`,
    files: {
      go: {
        path: 'door.go',
        source: `package door

// Limiter is a token bucket, one bucket per merchant.
// Tests call New and Allow. Use the standard library only.
type Limiter struct {
	burst    int
	refill   int
	windowMs int64
}

// New builds a limiter. burst, refill, and windowMs are all at least 1.
func New(burst, refill int, windowMs int64) *Limiter {
	return &Limiter{burst: burst, refill: refill, windowMs: windowMs}
}

// Allow reports whether merchant may proceed at nowMs.
// The bucket is created on the first call, full, with its clock at that nowMs.
func (l *Limiter) Allow(merchant string, nowMs int64) bool {
	return false
}
`,
      },
      python: {
        path: 'door.py',
        source: `class Limiter:
    """Token bucket, one bucket per merchant. Standard library only.

    The bucket is created on the first allow, full, with its clock at that now_ms.
    """

    def __init__(self, burst: int, refill: int, window_ms: int) -> None:
        self.burst = burst
        self.refill = refill
        self.window_ms = window_ms

    def allow(self, merchant: str, now_ms: int) -> bool:
        return False
`,
      },
      java: {
        path: 'Door.java',
        source: `/** Token bucket, one bucket per merchant. Standard library only. */
public class Door {
    public Door(int burst, int refill, long windowMs) {
    }

    /** The bucket is created on the first call, full, with its clock at that nowMs. */
    public boolean allow(String merchant, long nowMs) {
        return false;
    }
}
`,
      },
    },
  },
  {
    id: 'one-table-left',
    name: 'One table left',
    subtitle: 'Holds, confirms, and a race',
    blurb:
      'Hold a table, confirm it before the hold expires, and stay correct when two guests ask for the last table together.',
    status: 'ready',
    brief: `
The floor book holds a table for a guest and confirms it if they take it in time. Two requests can arrive together. The methods in the open file are safe for concurrent callers.

Time is a millisecond count the caller passes in. A hold made at \`now\` for \`holdMs\` expires at \`now + holdMs\`. At that exact millisecond the hold is over and the table is free, unless it was confirmed.

## Rules

- Table names and guest names are non-empty. \`holdMs\` is at least 1.
- A table is free, held, or confirmed.
- \`Hold\` succeeds when the table is free, when the current hold is already expired, or when this guest already holds it. The same guest holding again refreshes the expiry to \`now + holdMs\`.
- \`Hold\` fails when another guest holds it and that hold has not expired, or when the table is confirmed.
- \`Confirm\` succeeds when this guest holds the table and \`now\` is still before the expiry. The table stays confirmed.
- \`Confirm\` also succeeds when this guest has already confirmed it.
- \`Confirm\` fails when the hold has expired, the guest is wrong, the table is free, or another guest confirmed it.
- A confirmed table stays confirmed. A later \`Hold\` fails.

## Worked case

- Hold table 1 for Ada at 0 for 1000. Expires at 1000.
- Hold table 1 for Bo at 500. Fails. Ada still holds it.
- Confirm table 1 for Ada at 999. Succeeds.
- Hold table 1 for Bo at 5000. Fails. The table is confirmed.
- Hold table 2 for Bo at 0 for 100. Confirm for Bo at 100. Fails. The hold ended at 100.
- Hold table 2 for Cy at 100. Succeeds. The expired hold left the table free.

## Constraints

- Standard library only. Guard the shared book. Go has \`sync\`, Python has \`threading\`, Java has \`synchronized\`.
- Two \`Hold\` calls for the same free table must leave exactly one guest holding it.
${HOW_IT_RUNS}`,
    files: {
      go: {
        path: 'book.go',
        source: `package book

import "sync"

// Book is the floor book. Tests call New, Hold, and Confirm.
// Methods are safe for concurrent callers. Use the standard library only.
type Book struct {
	mu sync.Mutex
}

func New() *Book {
	return &Book{}
}

// Hold reserves table for guest until nowMs+holdMs.
func (b *Book) Hold(table, guest string, nowMs, holdMs int64) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	return false
}

// Confirm turns guest's active hold into a confirmed booking.
func (b *Book) Confirm(table, guest string, nowMs int64) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	return false
}
`,
      },
      python: {
        path: 'book.py',
        source: `import threading


class Book:
    """Floor book. Methods are safe for concurrent callers. Standard library only."""

    def __init__(self) -> None:
        self._mu = threading.Lock()

    def hold(self, table: str, guest: str, now_ms: int, hold_ms: int) -> bool:
        with self._mu:
            return False

    def confirm(self, table: str, guest: str, now_ms: int) -> bool:
        with self._mu:
            return False
`,
      },
      java: {
        path: 'Book.java',
        source: `/** Floor book. Methods are safe for concurrent callers. Standard library only. */
public class Book {
    public synchronized boolean hold(String table, String guest, long nowMs, long holdMs) {
        return false;
    }

    public synchronized boolean confirm(String table, String guest, long nowMs) {
        return false;
    }
}
`,
      },
    },
  },
];

export function getMachineCodingProblem(id: string | null | undefined): MachineCodingProblem | null {
  if (!id) return null;
  return MACHINE_CODING_PROBLEMS.find((problem) => problem.id === id) || null;
}
