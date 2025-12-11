#!/usr/bin/env python3
"""Fetch TV shows data from Trakt API with user ratings and optional TMDB posters."""

import json
import os
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# Load .env file if exists (for local testing)
env_file = Path(__file__).parent.parent / ".env"
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ.setdefault(key.strip(), val.strip())

USERNAME = "AniviaFlome"
TRAKT_API_URL = "https://api.trakt.tv"
TMDB_API_URL = "https://api.themoviedb.org/3"

STATUS_ORDER = {"watching": 0, "watched": 1, "watchlist": 2}
STATUS_DISPLAY = {"watching": "Currently Watching", "watched": "Watched", "watchlist": "Watchlist"}


def make_request(url, headers):
    req = Request(url, headers=headers)
    with urlopen(req, timeout=30) as res:
        return json.loads(res.read().decode())


def get_tmdb_poster(tmdb_id, tmdb_api_key):
    """Fetch poster path from TMDB API if key is available."""
    if not tmdb_id or not tmdb_api_key:
        return ""
    try:
        url = f"{TMDB_API_URL}/tv/{tmdb_id}?api_key={tmdb_api_key}"
        data = make_request(url, {})
        poster_path = data.get("poster_path", "")
        if poster_path:
            return f"https://image.tmdb.org/t/p/w300{poster_path}"
    except:
        pass
    return ""


def fetch(client_id):
    headers = {
        "Content-Type": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": client_id,
    }
    
    user_ratings = {}
    try:
        ratings = make_request(f"{TRAKT_API_URL}/users/{USERNAME}/ratings/shows", headers)
        for r in ratings:
            show_id = r.get("show", {}).get("ids", {}).get("trakt")
            if show_id:
                user_ratings[show_id] = r.get("rating", 0)
    except HTTPError as e:
        print(f"  Warning: Could not fetch ratings: {e.code}")
    
    result = {"ratings": user_ratings}
    
    for status, endpoint in [("watched", "watched/shows"), ("watchlist", "watchlist/shows")]:
        try:
            result[status] = make_request(f"{TRAKT_API_URL}/users/{USERNAME}/{endpoint}?extended=full", headers)
        except HTTPError as e:
            print(f"  Warning: Could not fetch {status}: {e.code}")
            result[status] = []
    
    return result


def transform(raw, tmdb_api_key=""):
    user_ratings = raw.get("ratings", {})
    categories = []
    total = 0
    
    for status in ["watched", "watchlist"]:
        items = raw.get(status, [])
        if not items:
            continue
        entries = []
        for item in items:
            show = item.get("show", item)
            ids = show.get("ids", {})
            trakt_id = ids.get("trakt")
            tmdb_id = ids.get("tmdb")
            
            rating = user_ratings.get(trakt_id, 0)
            poster = get_tmdb_poster(tmdb_id, tmdb_api_key) if tmdb_api_key else ""
            
            entries.append({
                "id": trakt_id,
                "title": show.get("title", "Unknown"),
                "year": show.get("year"),
                "posterImage": poster,
                "rating": rating,
                "url": f"https://trakt.tv/shows/{ids.get('slug', '')}",
            })
        
        entries.sort(key=lambda x: (-(x.get("rating") or 0), x["title"].lower()))
        
        categories.append({
            "status": status,
            "displayName": STATUS_DISPLAY.get(status, status.title()),
            "order": STATUS_ORDER.get(status, 99),
            "entries": entries,
            "count": len(entries),
        })
        total += len(entries)
    
    categories.sort(key=lambda x: x["order"])
    return {"username": USERNAME, "categories": categories, "totalCount": total}


def main():
    client_id = os.environ.get("TRAKT_CLIENT_ID")
    tmdb_api_key = os.environ.get("TMDB_API_KEY", "")
    
    if not client_id:
        print("📺 Skipping TV Shows (TRAKT_CLIENT_ID not set)")
        return
    
    data_dir = Path(__file__).parent.parent / "data"
    data_dir.mkdir(exist_ok=True)
    
    print(f"📺 Fetching TV Shows for: {USERNAME}")
    if tmdb_api_key:
        print("  (with TMDB posters)")
    else:
        print("  (without posters - TMDB_API_KEY not set)")
    
    try:
        data = transform(fetch(client_id), tmdb_api_key)
        with open(data_dir / "shows.json", "w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"  Saved {data['totalCount']} entries")
        for c in data["categories"]:
            print(f"    - {c['displayName']}: {c['count']}")
    except Exception as e:
        print(f"  ❌ Error: {e}")


if __name__ == "__main__":
    main()
