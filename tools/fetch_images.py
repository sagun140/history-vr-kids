"""Find a free-to-use lead image for each event on Wikipedia/Commons.
Writes tools/images.json (license + credit) and img/<id>.jpg (1000px).
Run: python3 tools/fetch_images.py   (overrides.json can pin a Commons file per id)"""
import json, os, re, subprocess, sys, time, urllib.parse
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "ButterflyAtlas/1.0 (https://github.com/sagun140/history-vr-kids; education)"}
FREE = re.compile(r"public domain|^pd|cc0|cc[- ]by|gfdl|attribution|no restrictions|free use|^OGL", re.I)

def get(url):
    # curl, because python.org builds on macOS often lack CA certificates
    r = subprocess.run(["curl", "-sSfL", "--retry", "3", "-m", "150", "-A", UA["User-Agent"], url], capture_output=True)
    if r.returncode: raise RuntimeError(r.stderr.decode()[:200])
    return r.stdout

def api(host, **params):
    params.update(format="json", formatversion=2)
    return json.loads(get(f"https://{host}/w/api.php?" + urllib.parse.urlencode(params)))

def strip(html): return re.sub(r"<[^>]+>", "", html or "").strip()

articles = json.load(open(f"{ROOT}/tools/articles.json"))
overrides = json.load(open(f"{ROOT}/tools/overrides.json")) if os.path.exists(f"{ROOT}/tools/overrides.json") else {}
out_path = f"{ROOT}/tools/images.json"
result = json.load(open(out_path)) if os.path.exists(out_path) else {}
os.makedirs(f"{ROOT}/img", exist_ok=True)
only = set(sys.argv[1:])

for eid, title in articles.items():
    if only and eid not in only: continue
    if not only and eid in result and "error" not in result[eid] and eid not in overrides: continue
    try:
        fname = overrides.get(eid)
        if fname and fname.startswith("search:"):
            hits = api("commons.wikimedia.org", action="query", list="search", srnamespace=6, srlimit=10, srsearch=fname[7:] + " filetype:bitmap")["query"]["search"]
            fname = next((h["title"][5:] for h in hits if re.search(r"\.(jpe?g|png)$", h["title"], re.I)), None)
        if not fname:
            pages = api("en.wikipedia.org", action="query", prop="pageimages", piprop="name", titles=title, redirects=1)["query"]["pages"]
            fname = pages[0].get("pageimage")
        if not fname:
            result[eid] = {"error": "no lead image", "article": title}; print("-", eid, "no image"); continue
        info = api("commons.wikimedia.org", action="query", prop="imageinfo", titles="File:" + fname,
                   iiprop="url|extmetadata|mime", iiurlwidth=1000)["query"]["pages"][0]
        if "imageinfo" not in info:
            result[eid] = {"error": "not on Commons (probably non-free)", "file": fname}; print("-", eid, "not on commons"); continue
        ii = info["imageinfo"][0]; md = ii.get("extmetadata", {})
        lic = strip(md.get("LicenseShortName", {}).get("value"))
        if not FREE.search(lic):
            result[eid] = {"error": "license " + lic, "file": fname}; print("-", eid, "license", lic); continue
        dest = f"{ROOT}/img/{eid}.jpg"
        tmp = dest + ".src"
        open(tmp, "wb").write(get(ii["thumburl"]))
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "68", "-Z", "960", tmp, "--out", dest], check=True, capture_output=True)
        os.remove(tmp)
        result[eid] = {"file": fname, "license": lic, "artist": strip(md.get("Artist", {}).get("value"))[:120],
                       "source": ii["descriptionurl"], "article": title}
        print("+", eid, fname, lic)
    except Exception as e:
        result[eid] = {"error": str(e)[:200]}; print("!", eid, e)
    json.dump(result, open(out_path, "w"), indent=1, ensure_ascii=False)
    time.sleep(0.3)
json.dump(result, open(out_path, "w"), indent=1, ensure_ascii=False)
