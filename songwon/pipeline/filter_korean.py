#!/usr/bin/env python3
"""
Filter Korean songs from a spotdl playlist JSON file.
Uses ISRC country code, hangul detection, and known Korean artist matching.
"""

import json
import re
import sys
from pathlib import Path

HANGUL_RANGE = re.compile(r'[가-힯ᄀ-ᇿ㄰-㆏ꥠ-꥿ힰ-퟿]')

KOREAN_GENRES = {
    'k-pop', 'kpop', 'korean', 'k pop',
    'k-rock', 'k-r&b', 'k-indie', 'k-rap', 'k-hip hop',
    'korean pop', 'korean r&b', 'korean hip hop', 'korean indie',
    'korean ost', 'k-drama ost', 'hangul', 'hallyu',
}

KNOWN_KOREAN_ARTISTS = {
    'bts', 'blackpink', 'iu', 'exo', 'twice', 'red velvet', 'bigbang',
    'lee hi', 'dean', 'zico', 'crush', 'heize', 'baek yerin', 'bol4',
    'akmu', 'epik high', 'hyukoh', '10cm', 'standing egg', 'nell',
    'park hyo shin', 'kim bum soo', 'naul', 'shinee', 'f(x)', '2ne1',
    'psy', 'jay park', 'zion.t', 'sunmi', 'chung ha', 'ailee',
    'kim jong kook', 'gummy', 'k.will', 'park won', 'paul kim',
    'melomelomance', 'melomance', 'btob', 'mamamoo', 'seventeen', 'got7',
    'stray kids', 'ateez', 'txt', '(g)i-dle', 'aespa', 'newjeans',
    'le sserafim', 'gaho', 'ben', 'davichi', 'day6', 'nct', 'nct 127',
    'nct dream', 'wayv', 'taeyang', 'taeyeon', 'g-dragon', 'sechskies',
    'jaurim', 'yoon jong shin', 'sung si kyung', 'lee moon sae',
    'lim jae beum', 'urban zakapa', 'busker busker', 'ftisland', 'cnblue',
    'n.flying', 'car, the garden', 'ha hyun woo', 'han dong geun', 'lyn',
    'sogyumo acacia band', 'kim hye rim', 'light & salt', 'jang pill soon',
    'nc.a', 'taeyong', 'junggigo', 'baekhyun', 'chen', 'chanyeol',
    'suho', 'd.o.', 'kai', 'sehun', 'xiumin', 'lay', 'kris',
    'solar', 'moonbyul', 'wheein', 'hwasa',
    'irene', 'seulgi', 'wendy', 'joy', 'yeri',
    'jennie', 'jisoo', 'rosé', 'lisa',
    'nayeon', 'jeongyeon', 'momo', 'sana', 'jihyo', 'mina', 'dahyun', 'chaeyoung', 'tzuyu',
    'boa', 'rain', 'se7en', 'wonder girls', 'super junior', 'tvxq',
    'snsd', "girls' generation", 'sistar', '4minute', 'miss a',
    'ikon', 'winner', 'treasure', 'itzy', 'nmixx', 'ive',
    'enhypen', 'the boyz', 'astro', 'monsta x', 'vixx',
    'b.a.p', 'block b', 'beast', 'highlight', 'infinite',
    'kim feel', 'kim dong ryul', 'yoon mirae', 'tiger jk',
    'drunken tiger', 'dynamic duo', 'leessang', 'gary', 'haha',
    'susan', 'chomyo', 'behindthemoon', 'jellyboy',
    'yerin baek', 'hyolyn',
    'jin',
}

KNOWN_NOT_KOREAN = {
    'lisa',  # ambiguous: BLACKPINK Lisa vs Japanese LiSA
    'eve',   # Japanese artist
    'miyu',  # Japanese
}

def has_hangul(text) -> bool:
    if not text:
        return False
    return bool(HANGUL_RANGE.search(str(text)))

def is_korean_genre(genres) -> bool:
    if not genres:
        return False
    for g in genres:
        gl = g.lower().strip()
        if any(kg in gl for kg in KOREAN_GENRES):
            return True
    return False

JAPANESE_RANGE = re.compile(r'[぀-ゟ゠-ヿ一-鿿]')

def has_japanese(text) -> bool:
    if not text:
        return False
    return bool(JAPANESE_RANGE.search(str(text))) and not has_hangul(str(text))

def is_known_korean_artist(artist_str, artists_list) -> bool:
    all_artists = [artist_str] + (artists_list or [])
    for a in all_artists:
        if not a:
            continue
        al = a.lower().strip()
        if al in KNOWN_NOT_KOREAN:
            continue
        if al in KNOWN_KOREAN_ARTISTS:
            return True
        words = al.split()
        if len(words) == 2:
            reversed_name = f"{words[1]} {words[0]}"
            if reversed_name in KNOWN_KOREAN_ARTISTS:
                return True
    return False

def classify_song(song: dict) -> tuple[bool, str]:
    """Returns (is_korean, reason)."""
    name = song.get('name') or ''
    artist = song.get('artist') or ''
    artists = song.get('artists') or []
    genres = song.get('genres') or []
    album = song.get('album_name') or ''
    isrc = song.get('isrc') or ''

    if isrc.upper().startswith('KR'):
        return True, 'isrc_kr'
    if has_hangul(name):
        return True, 'hangul_in_title'
    if has_hangul(artist) or any(has_hangul(a) for a in artists):
        return True, 'hangul_in_artist'
    if has_hangul(album):
        return True, 'hangul_in_album'
    if is_korean_genre(genres):
        return True, 'korean_genre'
    if is_known_korean_artist(artist, artists):
        if has_japanese(name) and not has_hangul(name):
            return False, ''
        return True, 'known_artist'

    return False, ''

def main():
    base = Path(__file__).parent
    input_file = base / 'playlist.spotdl'
    if not input_file.exists():
        input_file = base / 'playlist.json'
    if not input_file.exists():
        print(f"Error: no playlist file found in {base}. Is spotdl still running?", file=sys.stderr)
        sys.exit(1)
    print(f"Reading: {input_file.name}")

    with open(input_file, 'r', encoding='utf-8') as f:
        songs = json.load(f)

    korean_songs = []
    non_korean = []
    for song in songs:
        is_kr, reason = classify_song(song)
        if is_kr:
            korean_songs.append({**song, '_match_reason': reason})
        else:
            non_korean.append(song)

    output = {
        'total_playlist': len(songs),
        'korean_count': len(korean_songs),
        'non_korean_count': len(non_korean),
        'korean_songs': korean_songs,
        'non_korean_songs': non_korean,
    }

    out_file = base / 'korean_songs.json'
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\nTotal songs: {len(songs)}")
    print(f"Korean songs: {len(korean_songs)}")
    print(f"Non-Korean: {len(non_korean)}")
    print(f"\nSaved to: {out_file}")
    print("\n--- Korean Songs ---")
    for i, s in enumerate(korean_songs, 1):
        print(f"  {i:3d}. {s['artist']} — {s['name']}  [{s['_match_reason']}]")

    if non_korean:
        print(f"\n--- Non-Korean ({len(non_korean)} songs, check for missed Korean) ---")
        for i, s in enumerate(non_korean[:10], 1):
            print(f"  {i:3d}. {s.get('artist','')} — {s.get('name','')}")
        if len(non_korean) > 10:
            print(f"  ... and {len(non_korean)-10} more")

if __name__ == '__main__':
    main()
