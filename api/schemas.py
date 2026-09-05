from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ArtworkBase(BaseModel):
    poster_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    banner_path: Optional[str] = None

class ArtworkResponse(ArtworkBase):
    id: int
    episode_id: str

    class Config:
        orm_mode = True

class EpisodeBase(BaseModel):
    id: str
    title: str
    content_group: str
    language: str
    duration: Optional[int] = None

class EpisodeCreate(EpisodeBase):
    season_id: str

class EpisodeResponse(EpisodeBase):
    season_id: str
    artwork: Optional[ArtworkResponse] = None

    class Config:
        orm_mode = True

class SeasonBase(BaseModel):
    id: str
    season_number: int

class SeasonCreate(SeasonBase):
    show_id: str

class SeasonResponse(SeasonBase):
    show_id: str
    episodes: List[EpisodeResponse] = []

    class Config:
        orm_mode = True

class ShowBase(BaseModel):
    id: str
    title: str
    section: Optional[str] = None
    category: str
    status: str = "draft"

class ShowCreate(ShowBase):
    pass

class ShowResponse(ShowBase):
    seasons: List[SeasonResponse] = []

    class Config:
        orm_mode = True
