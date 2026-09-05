from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Header
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
import os
from PIL import Image
from io import BytesIO
from . import models, schemas
from .database import engine, get_db
from .storage import storage

from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from .auth import create_access_token, verify_password, get_password_hash, SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
import jwt
from datetime import timedelta
from typing import Annotated

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Peblo TV Mini API")

# Serve artwork from the same storage provider used by uploads.  Previously,
# uploaded files were written to ``uploads/artwork`` while this route served
# ``artwork``, leaving newly uploaded images inaccessible to clients.
artwork_directory = os.path.join(storage.base_dir, "artwork")
os.makedirs(artwork_directory, exist_ok=True)
app.mount("/artwork", StaticFiles(directory=artwork_directory), name="artwork")

def verify_admin_role(
    x_user_role: Annotated[str | None, Header()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    """Authorize publishing for the CMS mock role header or a JWT bearer token."""
    if x_user_role == "admin":
        return "admin"

    if authorization and authorization.lower().startswith("bearer "):
        try:
            payload = jwt.decode(authorization[7:], SECRET_KEY, algorithms=[ALGORITHM])
            if payload.get("role") == "admin":
                return "admin"
        except jwt.InvalidTokenError:
            pass

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")


def require_editor_role(x_user_role: Annotated[str | None, Header()] = None):
    """Allow CMS edits for the mock editor/admin roles used in this exercise."""
    role = x_user_role or "editor"
    if role not in {"editor", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Editor or admin role required")
    return role

ADMIN_HASH = get_password_hash("password")

@app.post("/admin/login")
def login(form_data: Annotated[OAuth2PasswordRequestForm, Depends()]):
    if form_data.username != "admin" or not verify_password(form_data.password, ADMIN_HASH):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": form_data.username, "role": "admin"}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to Peblo TV Mini API"}

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    # 1. Check Database Liveness
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database connection failed: {str(e)}")

    # 2. Check Storage Reachability
    if not os.path.exists(storage.base_dir) or not os.access(storage.base_dir, os.W_OK):
        raise HTTPException(status_code=503, detail="Storage directory not reachable or writable")

    return {"status": "ok", "message": "DB and Storage are healthy"}

# --- SHOWS ---

@app.get("/admin/shows", response_model=List[schemas.ShowResponse])
def read_shows(
    skip: int = 0,
    limit: int = 100,
    q: str = "",
    section: str = "",
    status_filter: str = "",
    language: str = "",
    db: Session = Depends(get_db),
    _: str = Depends(require_editor_role),
):
    query = db.query(models.Show)
    if q:
        query = query.filter(models.Show.title.ilike(f"%{q}%"))
    if section:
        query = query.filter(models.Show.section == section)
    if status_filter:
        query = query.filter(models.Show.status == status_filter)
    if language:
        query = query.join(models.Season, models.Season.show_id == models.Show.id).join(
            models.Episode, models.Episode.season_id == models.Season.id
        ).filter(models.Episode.language == language).distinct()
    shows = query.order_by(models.Show.title, models.Show.id).offset(skip).limit(min(limit, 100)).all()
    return shows

@app.post("/admin/shows", response_model=schemas.ShowResponse)
def create_show(show: schemas.ShowCreate, db: Session = Depends(get_db), _: str = Depends(require_editor_role)):
    db_show = models.Show(**show.dict())
    db.add(db_show)
    db.commit()
    db.refresh(db_show)
    return db_show

@app.get("/admin/shows/{show_id}", response_model=schemas.ShowResponse)
def read_show(show_id: str, db: Session = Depends(get_db), _: str = Depends(require_editor_role)):
    db_show = db.query(models.Show).filter(models.Show.id == show_id).first()
    if db_show is None:
        raise HTTPException(status_code=404, detail="Show not found")
    return db_show

@app.put("/admin/shows/{show_id}", response_model=schemas.ShowResponse)
def update_show(show_id: str, show: schemas.ShowCreate, db: Session = Depends(get_db), _: str = Depends(require_editor_role)):
    db_show = db.query(models.Show).filter(models.Show.id == show_id).first()
    if not db_show:
        raise HTTPException(status_code=404, detail="Show not found")
    
    db_show.title = show.title
    db_show.section = show.section
    db_show.category = show.category
    db_show.status = show.status
    
    try:
        db.commit()
        db.refresh(db_show)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return db_show

# --- SEASONS ---

@app.get("/admin/shows/{show_id}/seasons", response_model=List[schemas.SeasonResponse])
def read_seasons(show_id: str, db: Session = Depends(get_db), _: str = Depends(require_editor_role)):
    seasons = db.query(models.Season).filter(models.Season.show_id == show_id).order_by(models.Season.season_number).all()
    return seasons

@app.post("/admin/seasons", response_model=schemas.SeasonResponse)
def create_season(season: schemas.SeasonCreate, db: Session = Depends(get_db), _: str = Depends(require_editor_role)):
    db_season = models.Season(**season.dict())
    db.add(db_season)
    db.commit()
    db.refresh(db_season)
    return db_season

# --- EPISODES ---

@app.get("/admin/seasons/{season_id}/episodes", response_model=List[schemas.EpisodeResponse])
def read_episodes(season_id: str, db: Session = Depends(get_db), _: str = Depends(require_editor_role)):
    episodes = db.query(models.Episode).filter(models.Episode.season_id == season_id).order_by(models.Episode.title, models.Episode.language).all()
    return episodes

@app.post("/admin/episodes", response_model=schemas.EpisodeResponse)
def create_episode(episode: schemas.EpisodeCreate, db: Session = Depends(get_db), _: str = Depends(require_editor_role)):
    db_episode = models.Episode(**episode.dict())
    db.add(db_episode)
    try:
        db.commit()
        db.refresh(db_episode)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return db_episode

@app.get("/admin/episodes/{episode_id}", response_model=schemas.EpisodeResponse)
def read_episode(episode_id: str, db: Session = Depends(get_db)):
    db_episode = db.query(models.Episode).filter(models.Episode.id == episode_id).first()
    if db_episode is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    return db_episode

# --- ARTWORK UPLOAD ---

def validate_image(file_bytes: bytes, required_aspect: str, min_w: int, min_h: int, max_kb: int):
    # Check size
    size_kb = len(file_bytes) / 1024
    if size_kb > max_kb:
        raise HTTPException(status_code=400, detail=f"Image size {size_kb:.1f}KB exceeds max {max_kb}KB")
    
    # Check dimensions and aspect ratio
    try:
        img = Image.open(BytesIO(file_bytes))
        width, height = img.size
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")
    
    if width < min_w or height < min_h:
        raise HTTPException(status_code=400, detail=f"Image dimensions ({width}x{height}) are smaller than required ({min_w}x{min_h})")
    
    aspect_parts = required_aspect.split(":")
    target_ratio = float(aspect_parts[0]) / float(aspect_parts[1])
    actual_ratio = width / height
    
    # Allow some tolerance for aspect ratio (e.g. 1%)
    if abs(target_ratio - actual_ratio) > 0.05:
        raise HTTPException(status_code=400, detail=f"Image aspect ratio {actual_ratio:.2f} does not match required {required_aspect}")

@app.post("/admin/artwork/upload")
def upload_artwork(
    episode_id: str = Form(...),
    artwork_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: str = Depends(require_editor_role),
):
    if artwork_type not in ["poster", "banner", "thumbnail"]:
        raise HTTPException(status_code=400, detail="Invalid artwork type")

    # Read specs (hardcoded for now, or read from reference.json ideally)
    specs = {
        "poster": {"aspect": "2:3", "min_w": 600, "min_h": 900, "max_kb": 200},
        "banner": {"aspect": "16:9", "min_w": 1280, "min_h": 720, "max_kb": 200},
        "thumbnail": {"aspect": "16:9", "min_w": 640, "min_h": 360, "max_kb": 200},
    }
    
    spec = specs[artwork_type]
    file_bytes = file.file.read()
    validate_image(file_bytes, spec["aspect"], spec["min_w"], spec["min_h"], spec["max_kb"])

    # Save to storage
    ext = os.path.splitext(file.filename)[1]
    if not ext:
        ext = ".jpg"
    dest_path = f"artwork/{episode_id}/{artwork_type}{ext}"
    
    file.file.seek(0)
    saved_path = storage.save_file(file.file, dest_path)

    # Update Database
    db_episode = db.query(models.Episode).filter(models.Episode.id == episode_id).first()
    if not db_episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    db_artwork = db.query(models.Artwork).filter(models.Artwork.episode_id == episode_id).first()
    if not db_artwork:
        db_artwork = models.Artwork(episode_id=episode_id)
        db.add(db_artwork)
    
    if artwork_type == "poster":
        db_artwork.poster_path = saved_path
    elif artwork_type == "banner":
        db_artwork.banner_path = saved_path
    elif artwork_type == "thumbnail":
        db_artwork.thumbnail_path = saved_path
        
    db.commit()
    
    return {"message": "Upload successful", "path": saved_path}

# --- VALIDATION REPORT ---

@app.get("/admin/validation-report")
def get_validation_report(db: Session = Depends(get_db), _: str = Depends(require_editor_role)):
    report = []
    
    # 1. Shows missing sections
    shows = db.query(models.Show).all()
    for show in shows:
        if not show.section:
            report.append({
                "type": "show",
                "id": show.id,
                "title": show.title,
                "issue": "Show is missing a section"
            })
            
    # 2. Episodes missing duration or artwork
    episodes = db.query(models.Episode).all()
    for ep in episodes:
        issues = []
        if ep.duration is None:
            issues.append("Missing duration")
        
        # Check artwork
        if not ep.artwork or not ep.artwork.poster_path or not ep.artwork.banner_path or not ep.artwork.thumbnail_path:
            issues.append("Missing one or more artwork sizes (poster, banner, thumbnail)")
            
        if issues:
            report.append({
                "type": "episode",
                "id": ep.id,
                "title": ep.title,
                "show_title": ep.season.show.title if ep.season and ep.season.show else "Unknown",
                "issues": issues
            })
            
    # uniqueness of (content_group, language) is enforced by DB unique constraint
    return {"blocking_issues": report}

# --- PUBLISH ---

import json
import tempfile
from datetime import datetime

@app.post("/admin/catalog/publish")
def publish_catalog(user_id: str = "admin", db: Session = Depends(get_db), role: str = Depends(verify_admin_role)):
    # Check validation first
    val_report = get_validation_report(db)
    if val_report["blocking_issues"]:
        # Record failed run
        run = models.PublishRun(user_id=user_id, status="failed", error_message="Validation failed")
        db.add(run)
        db.commit()
        raise HTTPException(status_code=400, detail={"message": "Validation failed", "report": val_report})
        
    try:
        # Build catalog
        shows = db.query(models.Show).filter(models.Show.status == "published").order_by(
            models.Show.section, models.Show.title, models.Show.id
        ).all()
        catalog_by_section = {}
        
        item_count = 0
        for show in shows:
            section = show.section or "Uncategorized"
            if section not in catalog_by_section:
                catalog_by_section[section] = []
                
            show_data = {
                "id": show.id,
                "title": show.title,
                "category": show.category,
                "seasons": []
            }
            
            for season in sorted(show.seasons, key=lambda s: s.season_number):
                season_data = {
                    "id": season.id,
                    "season_number": season.season_number,
                    "episodes": []
                }
                
                # Group episodes by content_group
                cg_map = {}
                for ep in sorted(season.episodes, key=lambda e: (e.content_group, e.title, e.language, e.id)):
                    item_count += 1
                    cg = ep.content_group
                    if cg not in cg_map:
                        cg_map[cg] = {
                            "id": ep.id, # Base ID
                            "title": ep.title, # Base title
                            "content_group": cg,
                            "languages": [],
                            "duration": ep.duration,
                            "artwork": {
                                "poster": ep.artwork.poster_path if ep.artwork else None,
                                "banner": ep.artwork.banner_path if ep.artwork else None,
                                "thumbnail": ep.artwork.thumbnail_path if ep.artwork else None
                            }
                        }
                    cg_map[cg]["languages"].append(ep.language)
                
                season_data["episodes"] = [cg_map[key] for key in sorted(cg_map)]
                show_data["seasons"].append(season_data)
                
            catalog_by_section[section].append(show_data)
            
        catalog = {
            "sections": catalog_by_section,
            "published_at": datetime.utcnow().isoformat()
        }
        
        # Atomic write
        catalog_json = json.dumps(catalog, indent=2)
        
        # Create temp file
        with tempfile.NamedTemporaryFile('w', delete=False, dir=storage.base_dir, suffix='.json') as tf:
            tf.write(catalog_json)
            temp_name = tf.name
            
        # Move atomically
        final_path = os.path.join(storage.base_dir, "catalog.json")
        os.replace(temp_name, final_path)
        
        # Record success run
        run = models.PublishRun(user_id=user_id, status="success", item_count=item_count)
        db.add(run)
        db.commit()
        
        return {"message": "Publish successful", "item_count": item_count}
        
    except Exception as e:
        # Record failed run
        run = models.PublishRun(user_id=user_id, status="failed", error_message=str(e))
        db.add(run)
        db.commit()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/publish-runs")
def get_publish_runs(limit: int = 20, db: Session = Depends(get_db), _: str = Depends(require_editor_role)):
    runs = db.query(models.PublishRun).order_by(models.PublishRun.run_time.desc(), models.PublishRun.id.desc()).limit(min(limit, 100)).all()
    return [
        {
            "id": run.id,
            "user_id": run.user_id,
            "run_time": run.run_time.isoformat() if run.run_time else None,
            "status": run.status,
            "item_count": run.item_count,
            "error_message": run.error_message,
        }
        for run in runs
    ]

# --- VIEWER ENDPOINTS ---

from fastapi.responses import JSONResponse

@app.get("/catalog")
def get_catalog():
    try:
        catalog_bytes = storage.read_file("catalog.json")
        catalog_data = json.loads(catalog_bytes)
        return catalog_data
    except Exception:
        raise HTTPException(status_code=404, detail="Catalog not published yet")

@app.get("/catalog/search")
def search_catalog(q: str = "", category: str = "", language: str = "", section: str = ""):
    try:
        catalog_bytes = storage.read_file("catalog.json")
        catalog_data = json.loads(catalog_bytes)
    except Exception:
        raise HTTPException(status_code=404, detail="Catalog not published yet")
        
    results = []
    
    for sec, shows in catalog_data.get("sections", {}).items():
        if section and sec.lower() != section.lower():
            continue
            
        for show in shows:
            if category and show.get("category", "").lower() != category.lower():
                continue
                
            # Filter matches inside show
            show_matches = False
            if q and q.lower() in show.get("title", "").lower():
                show_matches = True
            elif q and q.lower() in show.get("category", "").lower():
                show_matches = True
                
            matching_episodes = []
            
            for season in show.get("seasons", []):
                for ep in season.get("episodes", []):
                    # Filter by language
                    if language and language.lower() not in [l.lower() for l in ep.get("languages", [])]:
                        continue
                        
                    # Filter by query
                    if q:
                        if not show_matches and q.lower() not in ep.get("title", "").lower():
                            continue
                            
                    matching_episodes.append(ep)
                    
            if matching_episodes:
                # Add to results
                show_copy = dict(show)
                show_copy["matching_episodes"] = matching_episodes
                del show_copy["seasons"]
                results.append(show_copy)
                
    return {"results": results}
