from typing import Optional, TYPE_CHECKING
import os

# Auto-load .env file if python-dotenv is available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

if TYPE_CHECKING:
    from .storage import TraceStore


class _Config:
    """Global configuration for agent-trace SDK."""

    def __init__(self):
        self._store: Optional["TraceStore"] = None

    @property
    def store(self) -> Optional["TraceStore"]:
        return self._store

    @store.setter
    def store(self, value: Optional["TraceStore"]) -> None:
        self._store = value


_config = _Config()


def configure(
    store: "TraceStore" = None,
    supabase_url: str = None,
    supabase_key: str = None,
) -> None:
    """
    Configure global settings for agent-trace.

    Args:
        store: TraceStore instance for auto-saving traces.
        supabase_url: Supabase project URL (or set SUPABASE_URL env var).
        supabase_key: Supabase anon/service key (or set SUPABASE_KEY env var).

    If supabase_url/supabase_key are provided (or available as env vars),
    a SupabaseTraceStore is automatically created.

    Examples:
        # Auto-detect from SUPABASE_URL and SUPABASE_KEY env vars
        configure()

        # Pass credentials directly
        configure(supabase_url="https://xxx.supabase.co", supabase_key="key")

        # Or provide your own store
        configure(store=InMemoryTraceStore())
    """
    if store is not None:
        _config.store = store
        return

    # Try to auto-configure Supabase from args or env vars
    url = supabase_url or os.environ.get("SUPABASE_URL")
    key = supabase_key or os.environ.get("SUPABASE_KEY")

    if url and key:
        from .storage import ThreadedSupabaseTraceStore
        _config.store = ThreadedSupabaseTraceStore(url=url, key=key)


def get_config() -> _Config:
    """Get the global configuration instance."""
    return _config
