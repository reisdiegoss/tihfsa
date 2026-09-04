import math

def cross(o, a, b):
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

def compute_convex_hull(points):
    points = sorted(list(set(points)))
    if len(points) <= 1:
        return points
    lower = []
    for p in points:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0.001:
            lower.pop()
        lower.append(p)
    upper = []
    for p in reversed(points):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0.001:
            upper.pop()
        upper.append(p)
    hull = lower[:-1] + upper[:-1]
    # Check orientation (clockwise for screen coordinates where y is down)
    area = 0
    for i in range(len(hull)):
        j = (i + 1) % len(hull)
        area += hull[i][0] * hull[j][1] - hull[j][0] * hull[i][1]
    if area < 0:
        hull.reverse()
    return hull

padX = 30
padTop = 45
padBottom = 30
radius = 24

members = [
  {"label": "Quarto 401", "x": -388, "y": 926, "w": 220, "h": 340},
  {"label": "Corredor", "x": -392, "y": 1204, "w": 220, "h": 340},
  {"label": "Quarto 402", "x": 230, "y": 930, "w": 220, "h": 340},
  {"label": "Quarto 403", "x": -116, "y": 1336, "w": 220, "h": 340},
  {"label": "Quarto 404", "x": -404, "y": 1520, "w": 220, "h": 340},
  {"label": "Quarto 405", "x": 164, "y": 1260, "w": 220, "h": 340},
  {"label": "Quarto 406", "x": 180, "y": 1589, "w": 220, "h": 340},
  {"label": "Quarto 407", "x": -120, "y": 1036, "w": 220, "h": 340},
  {"label": "Quarto 408", "x": -318, "y": 1820, "w": 220, "h": 340},
  {"label": "Quarto 409", "x": -683, "y": 1478, "w": 220, "h": 340},
  {"label": "Quarto 410", "x": -630, "y": 1788, "w": 220, "h": 340},
  {"label": "Quarto 411", "x": -77, "y": 1589, "w": 220, "h": 340},
  {"label": "Quarto 412", "x": -333, "y": 2088, "w": 220, "h": 340}
]

centers = []
for m in members:
    x1 = m['x'] - padX + radius
    y1 = m['y'] - padTop + radius
    x2 = m['x'] + m['w'] + padX - radius
    y2 = m['y'] + m['h'] + padBottom - radius
    centers.extend([(x1, y1), (x2, y1), (x2, y2), (x1, y2)])

hull = compute_convex_hull(centers)
print("Vértices do Convex Hull (sentido horário):")
for i, p in enumerate(hull):
    p_next = hull[(i + 1) % len(hull)]
    print(f"  {i}: {p} -> {p_next}")

# Test intersection with Rack 01
# Rack 01: x=98, y=1954, w=280, h=700
rack_margin = 25
rx1 = 98 - rack_margin
ry1 = 1954 - rack_margin
rx2 = 98 + 280 + rack_margin
ry2 = 1954 + 700 + rack_margin
print(f"\nRack 01 Bounding Box com Margem: [{rx1}, {rx2}] x [{ry1}, {ry2}]")

def seg_intersects_rect(p1, p2, rx1, ry1, rx2, ry2):
    # Check if segment crosses rectangle
    x1, y1 = p1
    x2, y2 = p2
    # Simple sampling check
    for t in [i/100.0 for i in range(101)]:
        x = x1 + t * (x2 - x1)
        y = y1 + t * (y2 - y1)
        if rx1 <= x <= rx2 and ry1 <= y <= ry2:
            return True
    return False

for i in range(len(hull)):
    p1 = hull[i]
    p2 = hull[(i + 1) % len(hull)]
    if seg_intersects_rect(p1, p2, rx1, ry1, rx2, ry2):
        print(f"!!! ARESTA CRUZA RACK 01: {p1} -> {p2}")
