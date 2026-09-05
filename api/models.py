from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()

class Show(Base):
    __tablename__ = "shows"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    section = Column(String, nullable=True) # Can be null for drafts
    category = Column(String, nullable=False)
    status = Column(String, nullable=False, default="draft")  # draft, published

    seasons = relationship("Season", back_populates="show", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(
            "(status = 'draft') OR (section IS NOT NULL)",
            name="check_published_show_has_section"
        ),
    )

class Season(Base):
    __tablename__ = "seasons"

    id = Column(String, primary_key=True, index=True)
    show_id = Column(String, ForeignKey("shows.id"), nullable=False)
    season_number = Column(Integer, nullable=False)

    show = relationship("Show", back_populates="seasons")
    episodes = relationship("Episode", back_populates="season", cascade="all, delete-orphan")

class Episode(Base):
    __tablename__ = "episodes"

    id = Column(String, primary_key=True, index=True)
    season_id = Column(String, ForeignKey("seasons.id"), nullable=False)
    title = Column(String, nullable=False)
    content_group = Column(String, nullable=False)
    language = Column(String, nullable=False)
    duration = Column(Integer, nullable=True)  # Required for publish, but can be null in draft

    season = relationship("Season", back_populates="episodes")
    artwork = relationship("Artwork", back_populates="episode", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint('content_group', 'language', name='_content_group_language_uc'),
    )

class Artwork(Base):
    __tablename__ = "artworks"

    id = Column(Integer, primary_key=True, index=True)
    episode_id = Column(String, ForeignKey("episodes.id"), nullable=False, unique=True)
    poster_path = Column(String, nullable=True)
    thumbnail_path = Column(String, nullable=True)
    banner_path = Column(String, nullable=True)

    episode = relationship("Episode", back_populates="artwork")

class PublishRun(Base):
    __tablename__ = "publish_runs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False)
    run_time = Column(DateTime, default=datetime.utcnow)
    status = Column(String, nullable=False) # success, failed
    item_count = Column(Integer, default=0)
    error_message = Column(String, nullable=True)
