import os
import tempfile
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import io
from PIL import Image

from api.main import app
from api.database import get_db
from api.models import Base, Show, Season, Episode, Artwork
from api.storage import storage, LocalStorageProvider

from sqlalchemy.pool import StaticPool

# Use an in-memory SQLite database for testing, shared across threads
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override dependencies
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    
    # Overwrite the storage provider to use a temp dir for tests
    temp_dir = tempfile.mkdtemp()
    original_base = storage.base_dir
    storage.base_dir = temp_dir
    
    yield
    
    Base.metadata.drop_all(bind=engine)
    storage.base_dir = original_base


def test_content_group_uniqueness():
    """
    Test that we cannot create two episodes with the same content_group and language.
    This enforces the DB-level uniqueness constraint.
    """
    db = TestingSessionLocal()
    
    show = Show(id="s1", title="Test Show", section="Kids", category="Animation")
    season = Season(id="se1", show_id="s1", season_number=1)
    ep1 = Episode(id="ep1", season_id="se1", title="Ep 1", content_group="cg1", language="en")
    
    db.add(show)
    db.add(season)
    db.add(ep1)
    db.commit()

    # Attempt to add another episode with same content_group and language
    ep2 = Episode(id="ep2", season_id="se1", title="Ep 1 dup", content_group="cg1", language="en")
    db.add(ep2)
    
    with pytest.raises(Exception): # SQLAlchemy IntegrityError
        db.commit()


def test_artwork_validation_dimensions():
    """
    Test that uploading an artwork enforces dimensions and aspect ratio.
    """
    db = TestingSessionLocal()
    # Need an episode first
    show = Show(id="s1", title="Test", section="Kids", category="Animation")
    season = Season(id="se1", show_id="s1", season_number=1)
    ep1 = Episode(id="ep1", season_id="se1", title="Ep 1", content_group="cg1", language="en")
    db.add_all([show, season, ep1])
    db.commit()

    # Create a small valid image in memory (Poster requires 600x900, 2:3)
    img_valid = Image.new("RGB", (600, 900), color="red")
    img_valid_bytes = io.BytesIO()
    img_valid.save(img_valid_bytes, format="JPEG")
    img_valid_bytes.seek(0)
    
    res = client.post(
        "/admin/artwork/upload",
        data={"episode_id": "ep1", "artwork_type": "poster"},
        files={"file": ("poster.jpg", img_valid_bytes, "image/jpeg")}
    )
    assert res.status_code == 200
    
    # Create an invalid image (too small)
    img_small = Image.new("RGB", (300, 450), color="blue")
    img_small_bytes = io.BytesIO()
    img_small.save(img_small_bytes, format="JPEG")
    img_small_bytes.seek(0)

    res = client.post(
        "/admin/artwork/upload",
        data={"episode_id": "ep1", "artwork_type": "poster"},
        files={"file": ("poster_small.jpg", img_small_bytes, "image/jpeg")}
    )
    assert res.status_code == 400
    assert "are smaller than required" in res.json()["detail"]


def test_publish_atomicity_and_validation():
    """
    Test that publishing fails if a show is missing a section or an episode is missing duration/artwork.
    Also tests that a successful publish generates the atomic file.
    """
    db = TestingSessionLocal()
    
    # Create a draft show without section
    show = Show(id="s1", title="Test Show", section=None, category="Animation", status="draft")
    season = Season(id="se1", show_id="s1", season_number=1)
    ep1 = Episode(id="ep1", season_id="se1", title="Ep 1", content_group="cg1", language="en", duration=None)
    
    db.add_all([show, season, ep1])
    db.commit()

    res = client.post("/admin/catalog/publish", headers={"x-user-role": "admin"})
    assert res.status_code == 400
    report = res.json()["detail"]["report"]["blocking_issues"]
    
    # We should have two blocking issues: 
    # 1. Show missing section
    # 2. Episode missing duration/artwork
    assert len(report) == 2
    assert report[0]["type"] == "show"
    assert "missing a section" in report[0]["issue"]
    
    assert report[1]["type"] == "episode"
    assert "Missing duration" in report[1]["issues"]

    # Now fix the data
    show.section = "Featured"
    show.status = "published"
    ep1.duration = 120
    artwork = Artwork(episode_id="ep1", poster_path="p.jpg", banner_path="b.jpg", thumbnail_path="t.jpg")
    db.add(artwork)
    db.commit()

    # Publish again
    res = client.post("/admin/catalog/publish", headers={"x-user-role": "admin"})
    assert res.status_code == 200
    assert res.json()["item_count"] == 1
    
    # Verify file exists
    assert os.path.exists(os.path.join(storage.base_dir, "catalog.json"))

def test_role_enforcement():
    """
    Test that publishing requires the admin role via the X-User-Role header.
    """
    db = TestingSessionLocal()
    # Create valid show
    show = Show(id="s2", title="Test", section="Featured", category="Animation", status="published")
    season = Season(id="se2", show_id="s2", season_number=1)
    ep1 = Episode(id="ep2", season_id="se2", title="Ep 1", content_group="cg2", language="en", duration=100)
    db.add_all([show, season, ep1])
    artwork = Artwork(episode_id="ep2", poster_path="p.jpg", banner_path="b.jpg", thumbnail_path="t.jpg")
    db.add(artwork)
    db.commit()

    # Request without admin role (default is editor)
    res = client.post("/admin/catalog/publish")
    assert res.status_code == 403
    assert "Admin role required" in res.json()["detail"]

    # Request with admin role
    res = client.post("/admin/catalog/publish", headers={"x-user-role": "admin"})
    assert res.status_code == 200

