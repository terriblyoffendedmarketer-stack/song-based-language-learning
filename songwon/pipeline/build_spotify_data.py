# build_spotify_data.py — Find Spotify track IDs for all 72 songs (no OAuth needed)
# Usage: python3 pipeline/build_spotify_data.py
# Requires: spotipy, SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET in .env.local
# Output: public/data/spotify_tracks.json
#
# Uses client credentials flow (no browser popup, no user auth).
# Can't create playlists — just finds track IDs for in-app use.

import json
import os
import sys
from pathlib import Path

PIPELINE_DIR = Path(os.path.dirname(os.path.abspath(__file__)))
PROJECT_DIR = PIPELINE_DIR.parent
MANIFEST = PIPELINE_DIR / "song_manifest.json"
OUTPUT = PROJECT_DIR / "public" / "data" / "spotify_tracks.json"


def load_credentials():
    env_path = PROJECT_DIR / ".env.local"
    creds = {}
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                key, val = line.split("=", 1)
                creds[key.strip()] = val.strip()
    client_id = os.environ.get("SPOTIFY_CLIENT_ID", creds.get("SPOTIFY_CLIENT_ID"))
    client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET", creds.get("SPOTIFY_CLIENT_SECRET"))
    return client_id, client_secret


def main():
    try:
        import spotipy
        from spotipy.oauth2 import SpotifyClientCredentials
    except ImportError:
        print("Error: pip3 install spotipy")
        sys.exit(1)

    client_id, client_secret = load_credentials()
    if not client_id or not client_secret:
        print("Error: SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET required in .env.local")
        sys.exit(1)

    sp = spotipy.Spotify(auth_manager=SpotifyClientCredentials(
        client_id=client_id,
        client_secret=client_secret,
    ))

    manifest = json.loads(MANIFEST.read_text())
    songs = manifest["songs"]

    tracks = []
    not_found = []

    for i, song in enumerate(songs):
        artist = song["artist"]
        title = song["name"]

        result = None
        for query in [f"artist:{artist} track:{title}", f"{artist} {title}"]:
            results = sp.search(q=query, type="track", limit=5, market="KR")
            items = results.get("tracks", {}).get("items", [])
            if items:
                result = items[0]
                break

        if result:
            tracks.append({
                "artist": artist,
                "title": title,
                "spotifyId": result["id"],
                "spotifyUri": result["uri"],
                "spotifyUrl": result["external_urls"]["spotify"],
                "albumArt": result["album"]["images"][0]["url"] if result["album"]["images"] else None,
                "previewUrl": result.get("preview_url"),
            })
            print(f"  [{i+1}/{len(songs)}] ✓ {artist} — {title}")
        else:
            not_found.append(f"{artist} — {title}")
            print(f"  [{i+1}/{len(songs)}] ✗ {artist} — {title}")

    print(f"\nFound: {len(tracks)}/{len(songs)}")

    if not_found:
        print(f"\nNot found ({len(not_found)}):")
        for s in not_found:
            print(f"  - {s}")

    output_data = {
        "tracks": tracks,
        "totalFound": len(tracks),
        "totalSongs": len(songs),
        "notFound": not_found,
    }

    OUTPUT.write_text(json.dumps(output_data, indent=2, ensure_ascii=False))
    print(f"\nSaved to: {OUTPUT}")


if __name__ == "__main__":
    main()
