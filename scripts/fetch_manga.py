#!/usr/bin/env python3
"""Fetch manga data from AniList API."""

import json
from pathlib import Path
from urllib.request import Request, urlopen

USERNAME = "AniviaFlome"
API_URL = "https://graphql.anilist.co"

QUERY = """
query ($username: String) {
  MediaListCollection(userName: $username, type: MANGA) {
    lists {
      status
      entries {
        score(format: POINT_10)
        progress
        media {
          id
          title { english romaji native }
          chapters
          volumes
          coverImage { large }
          status
          siteUrl
        }
      }
    }
  }
}
"""

STATUS_ORDER = {"CURRENT": 0, "REPEATING": 1, "COMPLETED": 2, "PAUSED": 3, "DROPPED": 4, "PLANNING": 5}
STATUS_DISPLAY = {
    "CURRENT": "Reading", "REPEATING": "Rereading", "COMPLETED": "Completed",
    "PAUSED": "On Hold", "DROPPED": "Dropped", "PLANNING": "Plan to Read",
}


def fetch():
    payload = json.dumps({"query": QUERY, "variables": {"username": USERNAME}}).encode()
    req = Request(API_URL, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    with urlopen(req, timeout=30) as res:
        return json.loads(res.read().decode())


def transform(raw):
    lists = raw.get("data", {}).get("MediaListCollection", {}).get("lists", [])
    by_status = {}
    
    for lst in lists:
        status = lst.get("status", "CURRENT")
        entries = []
        for e in lst.get("entries", []):
            m = e.get("media", {})
            t = m.get("title", {})
            entries.append({
                "id": m.get("id"),
                "title": t.get("english") or t.get("romaji") or t.get("native") or "Unknown",
                "coverImage": m.get("coverImage", {}).get("large", ""),
                "score": e.get("score", 0),
                "progress": e.get("progress", 0),
                "chapters": m.get("chapters"),
                "url": m.get("siteUrl", ""),
            })
        entries.sort(key=lambda x: (-x["score"], x["title"].lower()))
        by_status[status] = {
            "displayName": STATUS_DISPLAY.get(status, status),
            "order": STATUS_ORDER.get(status, 99),
            "entries": entries,
            "count": len(entries),
        }
    
    sorted_s = sorted(by_status.keys(), key=lambda x: STATUS_ORDER.get(x, 99))
    return {
        "username": USERNAME,
        "categories": [{"status": s, **by_status[s]} for s in sorted_s if by_status[s]["entries"]],
        "totalCount": sum(c["count"] for c in by_status.values()),
    }


def main():
    data_dir = Path(__file__).parent.parent / "data"
    data_dir.mkdir(exist_ok=True)
    
    print(f"📚 Fetching Manga for: {USERNAME}")
    try:
        data = transform(fetch())
        with open(data_dir / "manga.json", "w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"  Saved {data['totalCount']} entries")
        for c in data["categories"]:
            print(f"    - {c['displayName']}: {c['count']}")
    except Exception as e:
        print(f"  ❌ Error: {e}")


if __name__ == "__main__":
    main()
