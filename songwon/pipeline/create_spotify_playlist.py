# create_spotify_playlist.py — Creates a Spotify playlist of all 72 Songwon study songs
# Usage: python3 pipeline/create_spotify_playlist.py [--dry-run]
# Reads: pipeline/song_manifest.json
# Requires: SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env.local
# Installs: pip3 install spotipy
#
# First run opens a browser for Spotify OAuth. After that, uses cached token.
# Creates a public playlist called "Songwon Study Songs" on your account.
#
# Gotchas:
# - spotipy needs a redirect URI — uses http://localhost:8888/callback
# - Some songs may not be on Spotify or may have different names
# - Korean artist names sometimes need the Korean spelling to find the right track
# - The script prints unmatched songs so you can add them manually

import json
import os
import sys
import argparse
from pathlib import Path

PIPELINE_DIR = Path(os.path.dirname(os.path.abspath(__file__)))
PROJECT_DIR = PIPELINE_DIR.parent
MANIFEST = PIPELINE_DIR / "song_manifest.json"

PLAYLIST_NAME = "Songwon Study Songs 🎵"
PLAYLIST_DESC = "72 Korean songs for language learning with Songwon (송원). Study vocabulary and grammar through K-pop, K-indie, and K-drama OSTs."


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


def search_track(sp, artist: str, title: str) -> str | None:
    """Search Spotify for a track. Returns track URI or None."""
    queries = [
        f"artist:{artist} track:{title}",
        f"{artist} {title}",
    ]

    for q in queries:
        results = sp.search(q=q, type="track", limit=5, market="KR")
        tracks = results.get("tracks", {}).get("items", [])
        if tracks:
            return tracks[0]["uri"]

    return None


def main():
    parser = argparse.ArgumentParser(description="Create Songwon Spotify playlist")
    parser.add_argument("--dry-run", action="store_true", help="Search but don't create playlist")
    args = parser.parse_args()

    try:
        import spotipy
        from spotipy.oauth2 import SpotifyOAuth
    except ImportError:
        print("Error: pip3 install spotipy")
        sys.exit(1)

    client_id, client_secret = load_credentials()
    if not client_id or not client_secret:
        print("Error: SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET required in .env.local")
        sys.exit(1)

    manifest = json.loads(MANIFEST.read_text())
    songs = manifest["songs"]

    sp = spotipy.Spotify(auth_manager=SpotifyOAuth(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri="http://localhost:8888/callback",
        scope="playlist-modify-public",
        cache_path=str(PIPELINE_DIR / ".spotify_cache"),
    ))

    user = sp.current_user()
    print(f"Logged in as: {user['display_name']} ({user['id']})")

    found_uris = []
    not_found = []

    for i, song in enumerate(songs):
        artist = song["artist"]
        title = song["name"]
        uri = search_track(sp, artist, title)
        if uri:
            found_uris.append(uri)
            print(f"  [{i+1}/{len(songs)}] ✓ {artist} — {title}")
        else:
            not_found.append(f"{artist} — {title}")
            print(f"  [{i+1}/{len(songs)}] ✗ {artist} — {title}")

    print(f"\nFound: {len(found_uris)}/{len(songs)}")

    if not_found:
        print(f"\nNot found ({len(not_found)}):")
        for s in not_found:
            print(f"  - {s}")

    if args.dry_run:
        print("\n[DRY RUN] Would create playlist with", len(found_uris), "tracks")
        return

    if not found_uris:
        print("No tracks found. Nothing to create.")
        return

    playlist = sp.user_playlist_create(
        user["id"],
        PLAYLIST_NAME,
        public=True,
        description=PLAYLIST_DESC,
    )
    playlist_url = playlist["external_urls"]["spotify"]
    print(f"\nCreated playlist: {playlist_url}")

    # Spotify API allows max 100 tracks per request
    for i in range(0, len(found_uris), 100):
        batch = found_uris[i : i + 100]
        sp.playlist_add_items(playlist["id"], batch)

    print(f"Added {len(found_uris)} tracks")
    print(f"\nPlaylist URL: {playlist_url}")

    # Save playlist URL for the app
    playlist_data = {
        "url": playlist_url,
        "id": playlist["id"],
        "trackCount": len(found_uris),
        "notFound": not_found,
    }
    output_path = PROJECT_DIR / "public" / "data" / "spotify_playlist.json"
    output_path.write_text(json.dumps(playlist_data, indent=2))
    print(f"Saved playlist info to: {output_path}")


if __name__ == "__main__":
    main()
