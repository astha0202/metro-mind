from flask import Flask, jsonify, render_template
import json, os, collections

app = Flask(__name__)
BASE = os.path.dirname(__file__)

with open(os.path.join(BASE,"data","stations.json")) as f:
    stations = json.load(f)["stations"]

def clean(x):
    return x.lower().replace(" ","").replace("-","").replace(",","")

# 🔥 BUILD GRAPH USING SAME NAME MATCHING
graph = collections.defaultdict(list)
name_map = {}

# map names
for s in stations:
    name_map[clean(s["name"])] = s["name"]

# connect stations using SAME LINE NEIGHBORS
line_map = collections.defaultdict(list)

for s in stations:
    line_map[s["line"]].append(s["name"])

# 🔥 build edges from line order
for line in line_map:
    st = line_map[line]
    for i in range(len(st)):
        cur = clean(st[i])

        if i > 0:
            prev = clean(st[i-1])
            graph[cur].append(prev)
            graph[prev].append(cur)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/stations")
def get_stations():
    return jsonify({
        "stations":[
            {
                "name": s["name"],
                "lat": s["lat"],
                "lng": s["lng"]
            } for s in stations
        ]
    })

@app.route("/find-route/<o>/<d>")
def find(o,d):
    o,d = clean(o),clean(d)

    if o not in graph or d not in graph:
        return jsonify({"routes":[]})

    q = collections.deque([(o,[o])])

    while q:
        cur,path = q.popleft()

        if cur == d:
            return jsonify({
                "routes":[
                    {
                        "stations":[name_map[x] for x in path],
                        "duration": len(path)*2,
                        "stations_count": len(path),
                        "interchanges": len(path)//10
                    }
                ]
            })

        for nei in graph[cur]:
            if nei not in path:
                q.append((nei,path+[nei]))

    return jsonify({"routes":[]})

if __name__ == "__main__":
    app.run(debug=True)