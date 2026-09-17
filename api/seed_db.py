import os

from PIL import Image

from . import models
from .database import SessionLocal, engine
from .storage import storage

# Make sure tables exist
models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

def create_solid_image(path, width, height, color):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img = Image.new('RGB', (width, height), color=color)
    img.save(path)

colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33F5', '#F5FF33']
show_titles = ["Space Rangers", "Ocean Deep", "Mountain High", "City Lights", "Desert Storm"]
sections = ["Featured", "Trending", "Featured", "New Releases", "Trending"]
categories = ["Sci-Fi", "Documentary", "Action", "Drama", "Thriller"]

for i in range(5):
    show_id = f"dummy_show_{i}"
    
    # 1. Create Show
    show = models.Show(
        id=show_id,
        title=show_titles[i],
        section=sections[i],
        category=categories[i],
        status="published"
    )
    db.add(show)
    
    # 2. Create Seasons (Season 0 and Season 1)
    s0 = models.Season(id=f"dummy_s0_{i}", show_id=show_id, season_number=0)
    s1 = models.Season(id=f"dummy_s1_{i}", show_id=show_id, season_number=1)
    db.add_all([s0, s1])
    
    # 3. Create Episodes
    # Trailer
    ep_trailer = models.Episode(
        id=f"ep_trailer_{i}",
        season_id=s0.id,
        title=f"{show_titles[i]} Trailer",
        content_group=f"cg_trailer_{i}",
        language="en",
        duration=120
    )
    # Episode 1
    ep1_en = models.Episode(
        id=f"ep1_{i}_en",
        season_id=s1.id,
        title="The Beginning",
        content_group=f"cg_ep1_{i}",
        language="en",
        duration=1400
    )
    # Episode 1 (Spanish)
    ep1_es = models.Episode(
        id=f"ep1_{i}_es",
        season_id=s1.id,
        title="El Comienzo",
        content_group=f"cg_ep1_{i}",
        language="es",
        duration=1400
    )
    db.add_all([ep_trailer, ep1_en, ep1_es])
    db.commit()
    
    # 4. Create Artwork and Images
    for ep in [ep_trailer, ep1_en, ep1_es]:
        art = models.Artwork(episode_id=ep.id)
        
        poster_path = f"artwork/{ep.id}/poster.jpg"
        banner_path = f"artwork/{ep.id}/banner.jpg"
        thumb_path = f"artwork/{ep.id}/thumbnail.jpg"
        
        create_solid_image(os.path.join(storage.base_dir, poster_path), 600, 900, colors[i])
        create_solid_image(os.path.join(storage.base_dir, banner_path), 1280, 720, colors[i])
        create_solid_image(os.path.join(storage.base_dir, thumb_path), 640, 360, colors[i])
        
        art.poster_path = poster_path
        art.banner_path = banner_path
        art.thumbnail_path = thumb_path
        
        db.add(art)
        
    db.commit()

print("Successfully seeded 5 dummy shows with artwork!")
