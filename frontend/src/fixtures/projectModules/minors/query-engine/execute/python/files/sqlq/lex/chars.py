"""Character classifiers for the scanner."""


def is_ident_start(c: str) -> bool:
    return c == "_" or ("A" <= c <= "Z") or ("a" <= c <= "z")


def is_ident_part(c: str) -> bool:
    return is_ident_start(c) or is_digit(c)


def is_digit(c: str) -> bool:
    return "0" <= c <= "9"
