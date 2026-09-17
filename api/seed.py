import json
import os

from . import models
from .database import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)

def seed_db():
    db = SessionLocal()
    if db.query(models.Show).first():
        print("Database already seeded")
        db.close()
        return

    seed_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "seed_shows.json")
    if not os.path.exists(seed_path):
        print(f"Seed file not found at {seed_path}")
        db.close()
        return

    with open(seed_path, "r") as f:
        data = json.load(f)

    for show_data in data:
        show = models.Show(
            id=show_data["id"],
            title=show_data["title"],
            section=show_data["section"],
            category=show_data["category"],
            status=show_data["status"]
        )
        db.add(show)
        
        for season_data in show_data.get("seasons", []):
            season = models.Season(
                id=season_data["id"],
                show_id=show.id,
                season_number=season_data["season_number"]
            )
            db.add(season)
            
            for ep_data in season_data.get("episodes", []):
                ep = models.Episode(
                    id=ep_data["id"],
                    season_id=season.id,
                    title=ep_data["title"],
                    content_group=ep_data["content_group"],
                    language=ep_data["language"],
                    duration=ep_data.get("duration")
                )
                db.add(ep)
                
                art_data = ep_data.get("artwork")
                if art_data:
                    artwork = models.Artwork(
                        episode_id=ep.id,
                        poster_path=art_data.get("poster"),
                        thumbnail_path=art_data.get("thumbnail"),
                        banner_path=art_data.get("banner")
                    )
                    db.add(artwork)
                    
    db.commit()
    db.close()
    print("Database seeded successfully")

if __name__ == "__main__":
    seed_db()
