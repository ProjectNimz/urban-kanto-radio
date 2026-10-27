"""Urban Kanto local preview and cached RSS endpoint. Python standard library only."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlsplit
import json, re, threading, time, xml.etree.ElementTree as ET
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
FEED = "https://daily.bandcamp.com/feed"
TTL = 1800
LOCK = threading.Lock()
CACHE = None
PATTERN = re.compile(r"hip[ -]?hop|rap(?:per|ping)?\b|boom[ -]?bap|beat(?:maker|making| tape|s)\b|neo[ -]?soul|soul(?:ful)?\b|jazz|instrumental|shabazz", re.I)
def parse_feed(raw):
    doc = ET.fromstring(raw)
    stories, seen = [], set()
    for item in doc.findall("./channel/item"):
        title = item.findtext("title", "").strip()
        link = item.findtext("link", "").strip()
        parsed = urlsplit(link)
        if parsed.scheme != "https" or parsed.hostname != "daily.bandcamp.com" or link in seen: continue
        image_match = re.search(r'<img\b[^>]*\bsrc=["\']([^"\']+)["\']', item.findtext("description", ""), re.I)
        image = image_match.group(1) if image_match else None
        if image:
            image_url = urlsplit(image)
            if image_url.scheme != "https" or not re.fullmatch(r"(?:[a-z0-9-]+\.)?bcbits\.com", image_url.hostname or ""): image = None
        description = re.sub(r"<[^>]*>", " ", item.findtext("description", ""))
        if not PATTERN.search(title + " " + description): continue
        seen.add(link)
        categories = [e.text or "" for e in item.findall("category")]
        text = title + " " + description
        tags = ["worldwide"]
        if re.search(r"filipin|philippines|pinoy|manila|cebu", text, re.I): tags.append("pinoy")
        if any(re.search(r"release|album|review", c, re.I) for c in categories) or "/album-of-the-day/" in link: tags.append("releases")
        stories.append(dict(image=image,title=title,url=link,date=item.findtext("pubDate", ""),author=item.findtext("{http://purl.org/dc/elements/1.1/}creator", "Bandcamp Daily"),source="Bandcamp Daily",tags=tags,type=categories[0] if categories else "Music discovery"))
    return stories[:18]
def parse_bandwagon(raw):
    ns={"a":"http://www.w3.org/2005/Atom"}
    doc=ET.fromstring(raw); stories=[]; seen=set()
    for item in doc.findall("a:entry",ns):
        title=item.findtext("a:title","",ns).strip()
        html=item.findtext("a:content","",ns) or item.findtext("a:summary","",ns)
        intro=re.sub(r"<[^>]*>"," ",html)[:700]
        if not re.search(r"filipin|philippines|pinoy|manila|cebu|ben(?:&|&amp;)ben",title+" "+intro,re.I): continue
        links=item.findall("a:link",ns)
        link=next((v.get("href","") for v in links if v.get("rel","alternate")=="alternate"),"")
        parsed=urlsplit(link)
        if parsed.scheme!="https" or parsed.hostname not in ("www.bandwagon.asia","bandwagon.asia") or link in seen: continue
        seen.add(link); tags=["pinoy"]
        if re.search(r"release|album|single|ep\b",title,re.I):tags.append("releases")
        stories.append(dict(title=title,url=link,date=item.findtext("a:published","",ns) or item.findtext("a:updated","",ns),author=item.findtext("a:author/a:name","Bandwagon",ns),source="Bandwagon",tags=tags,type="Philippine music",image=None))
    return stories[:12]
def get_feed():
    global CACHE
    with LOCK:
        if CACHE and time.time()-CACHE[0] < TTL: return CACHE[1]
        try:
            previous=CACHE[1] if CACHE else {}
            if not previous:
                try: previous=json.loads((ROOT/"dispatch-cache.json").read_text(encoding="utf-8"))
                except (OSError,ValueError): previous={"stories":[]}
            stories=[]; statuses=[]
            for name,url,parse in [("Bandcamp Daily",FEED,parse_feed),("Bandwagon","https://www.bandwagon.asia/feeds/articles.atom",parse_bandwagon)]:
                try:
                    req=Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; UrbanKantoRadio/1.0; RSS reader)"})
                    with urlopen(req,timeout=12) as response: raw=response.read(2_000_001)
                    if len(raw)>2_000_000:raise ValueError("Feed too large")
                    stories.extend(parse(raw));statuses.append(dict(name=name,stale=False))
                except Exception:
                    stories.extend(v for v in previous.get("stories",[]) if v.get("source")==name)
                    statuses.append(dict(name=name,stale=True))
            if all(v["stale"] for v in statuses):raise ValueError("Feeds unavailable")
            from email.utils import parsedate_to_datetime
            def stamp(story):
                try:return datetime.fromisoformat(story["date"]).timestamp()
                except ValueError:
                    try:return parsedate_to_datetime(story["date"]).timestamp()
                    except (ValueError,TypeError):return 0
            stories.sort(key=stamp,reverse=True)
            data=dict(stories=stories[:30],updatedAt=datetime.now(timezone.utc).isoformat(),stale=any(v["stale"] for v in statuses),sources=statuses)
            CACHE = (time.time(), data)
            try:
                (ROOT/"dispatch-cache.json").write_text(json.dumps(data,ensure_ascii=False), encoding="utf-8")
                (ROOT/"dispatch-data.js").write_text("window.DISPATCH_SNAPSHOT = "+json.dumps(data,ensure_ascii=False).replace("<","\u003c")+";", encoding="utf-8")
            except OSError:
                pass  # Read-only hosting can still serve the in-memory cache.
            return data
        except Exception:
            if CACHE: return dict(CACHE[1],stale=True)
            try: return dict(json.loads((ROOT/"dispatch-cache.json").read_text(encoding="utf-8")),stale=True)
            except (OSError,ValueError): return dict(stories=[],updatedAt=None,stale=True,source=FEED)
class PreviewServer(ThreadingHTTPServer):
    request_queue_size = 128
    daemon_threads = True

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT),**kwargs)
    def do_GET(self):
        if urlsplit(self.path).path == "/api/dispatch":
            body=json.dumps(get_feed(),ensure_ascii=False).encode()
            self.send_response(200);self.send_header("Content-Type","application/json; charset=utf-8");self.send_header("Cache-Control","no-store");self.send_header("Content-Length",str(len(body)));self.end_headers();self.wfile.write(body)
        elif urlsplit(self.path).path.startswith(("/assets/", "/vendor/")) or urlsplit(self.path).path in ("/", "/index.html", "/dispatch-data.js", "/dispatch-cache.json", "/events.html", "/community.html", "/dj.html", "/dj-panel.js", "/notifications.js", "/community-chat.js", "/performance-utils.js", "/events-data.js", "/events.js", "/station-config.js", "/offline.html", "/radio-player.js", "/player-loader.js", "/navigation.js", "/pwa.js", "/sw.js", "/manifest.webmanifest"):
            super().do_GET()
        else: self.send_error(404)
if __name__ == "__main__":
    import sys
    if "--refresh" in sys.argv:
        data=get_feed();print(json.dumps({"stories":len(data["stories"]),"stale":data["stale"],"updatedAt":data["updatedAt"]}))
    else:
        print("Urban Kanto Radio: http://127.0.0.1:8787",flush=True)
        PreviewServer(("127.0.0.1",8787),Handler).serve_forever()
