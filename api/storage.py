import os
import shutil
from abc import ABC, abstractmethod
from typing import BinaryIO

class StorageProvider(ABC):
    @abstractmethod
    def save_file(self, file_obj: BinaryIO, destination_path: str) -> str:
        pass

    @abstractmethod
    def read_file(self, path: str) -> bytes:
        pass

class LocalStorageProvider(StorageProvider):
    def __init__(self, base_dir: str):
        self.base_dir = base_dir
        os.makedirs(self.base_dir, exist_ok=True)

    def save_file(self, file_obj: BinaryIO, destination_path: str) -> str:
        full_path = os.path.join(self.base_dir, destination_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "wb") as buffer:
            shutil.copyfileobj(file_obj, buffer)
        return destination_path

    def read_file(self, path: str) -> bytes:
        full_path = os.path.join(self.base_dir, path)
        with open(full_path, "rb") as f:
            return f.read()

# Keep storage anchored to the API package rather than the process working
# directory, so local Uvicorn, tests, and Docker use the same files.
storage = LocalStorageProvider(base_dir=os.path.join(os.path.dirname(__file__), "uploads"))
