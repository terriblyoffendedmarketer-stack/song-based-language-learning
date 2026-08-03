#!/usr/bin/env python3
"""
Extract all tracks from a Spotify playlist and save as JSON.

Requires:
  pip3 install spotipy

Environment (in ../.env.local):
  SPOTIFY_CLIENT_ID=...
  SPOTIFY_CLIENT_SECRET=...

Usage:
  python3 pipeline/extract_playlist.py <playlist_url_or_id>

Output: pipeline/playlist.spotdl (JSON with all tracks, metadata, ISRC codes)

Example:
  python3 pipeline/extract_playlist.py https://open.spotify.com/playlist/4nMJOVlMKyHwMfBN7Iba7X
"""

import json
import os
import re
import sys

PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(PIPELINE_DIR, "playlist.spotdl")


def load_env():
    env_path = os.path.join(PIPELINE_DIR, '..', '.env.local')
    env = {}
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if '=' in line and not line.startswith('#'):
                    key, val = line.split('=', 1)
                    env[key.strip()] = val.strip()
    return env


def extract_playlist_id(url_or_id):
    match = re.search(r'playlist[/:]([a-zA-Z0-9]+)', url_or_id)
    if match:
        return match.group(1)
    return url_or_id


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 pipeline/extract_playlist.py <playlist_url_or_id>")
        print("\nExample:")
        print("  python3 pipeline/extract_playlist.py https://open.spotify.com/playlist/4nMJOVlMKyHwMfBN7Iba7X")
        sys.exit(1)

    env = load_env()
    client_id = env.get('SPOTIFY_CLIENT_ID')
    client_secret = env.get('SPOTIFY_CLIENT_SECRET')

    if not client_id or not client_secret:
        print("Error: SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set in .env.local")
        sys.exit(1)

    try:
        import spotipy
        from spotipy.oauth2 import SpotifyClientCredentials
    except ImportError:
        print("Error: spotipy not installed. Run: pip3 install spotipy")
        sys.exit(1)

    playlist_id = extract_playlist_id(sys.argv[1])
    print(f"Extracting playlist: {playlist_id}")

    sp = spotipy.Spotify(auth_manager=SpotifyClientCredentials(
        client_id=client_id,
        client_secret=client_secret,
    ))

    playlist = sp.playlist(playlist_id)
    print(f"Playlist: {playlist['name']} ({playlist['tracks']['total']} tracks)")

    tracks = []
    results = playlist['tracks']
    while True:
        for item in results['items']:
            track = item.get('track')
            if not track:
                continue

            artists = [a['name'] for a in track['artists']]
            artist_genres = []
            for a in track['artists']:
                try:
                    artist_info = sp.artist(a['id'])
                    artist_genres.extend(artist_info.get('genres', []))
                except Exception:
                    pass

            tracks.append({
                "name": track['name'],
                "artists": artists,
                "artist": artists[0] if artists else "Unknown",
                "album": track['album']['name'] if track.get('album') else None,
                "duration_ms": track['duration_ms'],
                "isrc": track.get('external_ids', {}).get('isrc'),
                "spotify_id": track['id'],
                "artist_genres": list(set(artist_genres)),
                "popularity": track.get('popularity', 0),
            })

        if results['next']:
            results = sp.next(results)
        else:
            break

    output = {
        "playlist_name": playlist['name'],
        "playlist_id": playlist_id,
        "total_tracks": len(tracks),
        "tracks": tracks,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\nSaved {len(tracks)} tracks to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
