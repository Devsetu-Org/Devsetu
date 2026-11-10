"""Chapter 4 replaces this file. Until then persist is a no-op."""


class PersistMixin:
    def persist(self) -> None:
        """Save current_term, voted_for and the log. mu held."""

    def read_persist(self) -> None:
        """Restore what persist saved. make calls it before any thread starts."""
