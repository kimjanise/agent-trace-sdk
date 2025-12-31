from abc import ABC, abstractmethod
from typing import List, Optional
from pathlib import Path
import json
from .models import Trace


class TraceStore(ABC):    
    @abstractmethod
    def save(self, trace: Trace) -> None:
        pass
    
    @abstractmethod
    def get(self, trace_id: str) -> Optional[Trace]:
        pass
    
    @abstractmethod
    def list(self, limit: int = 100) -> List[Trace]:
        pass


class InMemoryTraceStore(TraceStore):
    def __init__(self):
        self._traces = {}
    
    def save(self, trace: Trace) -> None:
        self._traces[trace.trace_id] = trace
    
    def get(self, trace_id: str) -> Optional[Trace]:
        return self._traces.get(trace_id)
    
    def list(self, limit: int = 100) -> List[Trace]:
        traces = list(self._traces.values())
        traces.sort(key=lambda t: t.started_at, reverse=True)
        return traces[:limit]
    
    def clear(self) -> None:
        self._traces.clear()


class FileTraceStore(TraceStore):
    def __init__(self, base_path: str = "./traces"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
    
    def save(self, trace: Trace) -> None:
        path = self.base_path / f"{trace.trace_id}.json"
        with open(path, "w") as f:
            json.dump(trace.to_dict(), f, indent=2, default=str)
    
    def get(self, trace_id: str) -> Optional[Trace]:
        path = self.base_path / f"{trace_id}.json"
        if not path.exists():
            return None
        with open(path) as f:
            return json.load(f)
    
    def list(self, limit: int = 100) -> List[dict]:
        traces = []
        for path in self.base_path.glob("*.json"):
            with open(path) as f:
                traces.append(json.load(f))
        traces.sort(key=lambda t: t.get("started_at", ""), reverse=True)
        return traces[:limit]