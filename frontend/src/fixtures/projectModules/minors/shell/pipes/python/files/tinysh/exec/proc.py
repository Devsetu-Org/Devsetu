"""One started external command."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import IO, Any, Optional


@dataclass
class Proc:
    cmd: Any = None  # subprocess.Popen
    files: list = field(default_factory=list)
