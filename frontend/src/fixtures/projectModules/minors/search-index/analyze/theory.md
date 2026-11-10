## Where you are
<!-- mode: read-only -->

A search index never stores raw prose as the thing it queries. The first stage, the **analyzer**, turns a string into a list of **tokens**: the words that will become keys in the inverted index.

```plaintext
  "The Cat in the Hat."
            │
            ▼
       cat · hat
```

Punctuation disappears. Stopwords disappear. Case folds away. Documents and queries must share this function, or a query for `Cat` will miss a document that only stored `cat`.

> [!scope] This chapter's job
> Only the analyzer. No postings, no disk, no ranking. When you finish, `Analyze` turns a
> string into a stable token list that the rest of the engine will trust.

## Split, fold, filter
<!-- mode: read-only -->

Three steps, always in this order:

1. **Tokenize** — keep runs of Unicode letters; everything else is a separator.
2. **Lower** — fold each token with Unicode lowercasing.
3. **Filter stopwords** — drop tokens in the fixed `Stopwords` set.

```plaintext
  "Don't Stop — Believin'!"
       │ tokenize
       ▼
  Don · t · Stop · Believin
       │ lower
       ▼
  don · t · stop · believin
       │ stopwords (stop is not in our list; "t" stays)
       ▼
  don · t · stop · believin
```

<!-- lang: go -->
`Stopwords` lives in `internal/analyze/stopwords.go` and is given. `Analyze` in `analyze.go` already chains the three functions. You fill in `Tokenize`, `Lower`, and `FilterStop`.
<!-- /lang -->
<!-- lang: python -->
`STOPWORDS` lives in `findx/analyze/stopwords.py` and is given. `analyze` in `analyze.py` already chains the three functions. You fill in `tokenize`, `lower`, and `filter_stop`.
<!-- /lang -->
<!-- lang: cpp -->
`Stopwords()` lives in `src/analyze/stopwords.cc` and is given. `Analyze` in `analyze.cc` already chains the three functions. `NextCodepoint`, `IsLetter`, and `ToLowerUtf8` are given in `letters.cc`. You fill in `Tokenize`, `Lower`, and `FilterStop`.
<!-- /lang -->

## Tokenize
<!-- mode: read-and-implement tasks:1.1 -->

A token is a maximal run of letters. Digits do not join a token. Apostrophes and hyphens split.

```plaintext
  Hello, world! 123  →  Hello · world
  don't              →  don · t
```

<!-- lang: go -->
### `TODO(1.1)` — `Tokenize`

In `internal/analyze/analyze.go`:

1. Walk the string by rune.
2. When `unicode.IsLetter(r)`, append to a `strings.Builder`.
3. On a non-letter (or at the end), if the builder is non-empty, append `b.String()` to the result and reset.
4. Return the slice. Empty input may return `nil` or an empty slice.
<!-- /lang -->
<!-- lang: python -->
### `TODO(1.1)` — `tokenize`

In `findx/analyze/analyze.py`:

1. Walk characters. When `ch.isalpha()`, append to a buffer.
2. On a non-letter (or at the end), if the buffer is non-empty, append `"".join(buf)` to the result and clear.
3. Return the list. Empty input may return `[]`.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(1.1)` — `Tokenize`

In `src/analyze/analyze.cc`:

1. Walk UTF-8 with `NextCodepoint`. When `IsLetter(cp)`, append the raw bytes to a buffer.
2. On a non-letter (or at the end), if the buffer is non-empty, push it and clear.
3. Return the vector. Empty input may return an empty vector.
<!-- /lang -->

## Lowercase
<!-- mode: read-and-implement tasks:1.2 -->

Indexing is case-insensitive. Lowercasing is a separate step so the tokenizer can keep the original spelling for debugging if you print it.

<!-- lang: go -->
### `TODO(1.2)` — `Lower`

Allocate a new slice the same length as `tokens`. Set each element to `strings.ToLower(tokens[i])`. Do not modify the input slice.
<!-- /lang -->
<!-- lang: python -->
### `TODO(1.2)` — `lower`

Allocate a new list the same length as `tokens`. Set each element to `tokens[i].lower()`. Do not modify the input list.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(1.2)` — `Lower`

Allocate a new vector the same size as `tokens`. Set each element to `ToLowerUtf8(tokens[i])`. Do not modify the input vector.
<!-- /lang -->

## Stopwords
<!-- mode: read-and-implement tasks:1.3 -->

`the`, `and`, `a`, and the rest of `Stopwords` are too common to be useful as index keys. Drop them after lowercasing. Unknown tokens stay.

<!-- lang: go -->
### `TODO(1.3)` — `FilterStop`

For each token, if it is a key in `Stopwords`, skip it. Otherwise append it. Preserve order.
<!-- /lang -->
<!-- lang: python -->
### `TODO(1.3)` — `filter_stop`

For each token, if it is in `STOPWORDS`, skip it. Otherwise append it. Preserve order.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(1.3)` — `FilterStop`

For each token, if it is in `Stopwords()`, skip it. Otherwise append it. Preserve order.
<!-- /lang -->

## Prove it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test
make race
printf '%s\n' "The Cat in the Hat." | make run
```
<!-- /lang -->
<!-- lang: python -->
```bash
make test
printf '%s\n' "The Cat in the Hat." | make run
```
<!-- /lang -->
<!-- lang: cpp -->
```bash
make test
make asan
printf '%s\n' "The Cat in the Hat." | make run
```
<!-- /lang -->

The REPL prints one line of space-separated tokens per input line.

> [!check] Before you move on
> 1. Letters form tokens; digits and punctuation do not.
> 2. Output tokens are lowercase.
> 3. Stopwords are gone; content words remain.
> 4. `Analyze("The Cat in the Hat.")` is `cat`, `hat`.

### What is missing

Tokens are not yet attached to documents. Chapter 2 builds posting lists: for each term, the documents that contain it and how often.
