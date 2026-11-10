from .shell import Shell, New
from . import line as _line  # noqa: F401  binds Shell.run_line

__all__ = ["Shell", "New"]
