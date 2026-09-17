
from pydantic import BaseModel


class ArtworkBase(BaseModel):
    poster_path: str | None = None
    thumbnail_path: str | None = None
    banner_path: str | None = None

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
    duration: int | None = None

class EpisodeCreate(EpisodeBase):
    season_id: str

class EpisodeResponse(EpisodeBase):
    season_id: str
    artwork: ArtworkResponse | None = None

    class Config:
        orm_mode = True

class SeasonBase(BaseModel):
    id: str
    season_number: int

class SeasonCreate(SeasonBase):
    show_id: str

class SeasonResponse(SeasonBase):
    show_id: str
    episodes: list[EpisodeResponse] = []

    class Config:
        orm_mode = True

class ShowBase(BaseModel):
    id: str
    title: str
    section: str | None = None
    category: str
    status: str = "draft"

class ShowCreate(ShowBase):
    pass

class ShowResponse(ShowBase):
    seasons: list[SeasonResponse] = []

    class Config:
        orm_mode = True
