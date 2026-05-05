#!/usr/bin/env python3
import sys
import json
import urllib.request
import urllib.parse

BASE_URL = "https://www.sbazar.cz"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "cs-CZ,cs;q=0.9",
}


def search(phrase, limit=10, price_from=None, price_to=None, offset=0):
    params = {"phrase": phrase, "limit": limit, "offset": offset}
    if price_from is not None:
        params["price_from"] = price_from
    if price_to is not None:
        params["price_to"] = price_to

    url = f"{BASE_URL}/api/v1/items/search?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def fmt_price(item):
    if item.get("price_by_agreement"):
        return "dohodou"
    price = item.get("price")
    return f"{price:,} Kč".replace(",", " ") if price is not None else "zdarma"


def fmt_locality(loc):
    if not loc:
        return "—"
    parts = [loc.get("municipality") or loc.get("quarter"), loc.get("district")]
    return ", ".join(p for p in parts if p and parts.index(p) == 0 or p != parts[0])


phrase = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "steam deck"
print(f"Searching for: {phrase!r}\n")

data = search(phrase)
pagination = data["pagination"]
results = data["results"]

print(f"Found {pagination['total']} total results (showing {len(results)}):\n")

for i, item in enumerate(results, 1):
    url = f"{BASE_URL}/inzerat/{item['seo_name']}"
    print(f"{i:2}. {item['name']}")
    print(f"    Price:    {fmt_price(item)}")
    print(f"    Location: {fmt_locality(item.get('locality'))}")
    print(f"    URL:      {url}")
    print()
