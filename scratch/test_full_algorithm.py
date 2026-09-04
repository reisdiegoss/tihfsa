import math

def compute_convex_hull(points):
    points = sorted(list(set(points)))
    if len(points) <= 1:
        return points
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
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
    area = 0
    for i in range(len(hull)):
        j = (i + 1) % len(hull)
        area += hull[i][0] * hull[j][1] - hull[j][0] * hull[i][1]
    if area < 0:
        hull.reverse()
    return hull

def avoid_racks_in_hull(hull, racks, margin=25):
    if not racks or len(hull) < 3:
        return hull
        
    current_hull = list(hull)
    
    for r in racks:
        rw = r.get("width") or 280
        rh = r.get("height") or 700
        rx1 = r["x"] - margin
        rx2 = r["x"] + rw + margin
        ry1 = r["y"] - margin
        ry2 = r["y"] + rh + margin
        
        next_hull = []
        n = len(current_hull)
        
        for i in range(n):
            p1 = current_hull[i]
            p2 = current_hull[(i + 1) % n]
            
            # Check intersection of segment p1 -> p2 with box [rx1, rx2] x [ry1, ry2]
            steps = 40
            intersects = False
            for s in range(1, steps):
                t = s / steps
                x = p1[0] + t * (p2[0] - p1[0])
                y = p1[1] + t * (p2[1] - p1[1])
                if rx1 < x < rx2 and ry1 < y < ry2:
                    intersects = True
                    break
                    
            next_hull.append(p1)
            
            if intersects:
                TL = (rx1, ry1)
                TR = (rx2, ry1)
                BL = (rx1, ry2)
                BR = (rx2, ry2)
                
                detour = []
                
                # Case 1: Trajectory comes from above/right and goes to left/down
                if p1[0] >= rx1 and p1[1] <= ry1 and p2[0] <= rx1:
                    detour.append(TL)
                    if p2[1] > ry1:
                        detour.append((rx1, min(p2[1], ry2)))
                        
                # Case 2: Trajectory comes from above/left and goes to right/down
                elif p1[0] <= rx2 and p1[1] <= ry1 and p2[0] >= rx2:
                    detour.append(TR)
                    if p2[1] > ry1:
                        detour.append((rx2, min(p2[1], ry2)))
                        
                # Case 3: Trajectory comes from below/right and goes to left/up
                elif p1[1] >= ry2 and p2[1] <= ry2 and p2[0] <= rx1:
                    detour.append(BL)
                    if p2[1] < ry2:
                        detour.append((rx1, max(p2[1], ry1)))
                        
                # Case 4: Trajectory comes from below/left and goes to right/up
                elif p1[1] >= ry2 and p2[1] <= ry2 and p2[0] >= rx2:
                    detour.append(BR)
                    if p2[1] < ry2:
                        detour.append((rx2, max(p2[1], ry1)))
                        
                # General fallback: pick corner that minimizes detour distance
                else:
                    corners = [TL, TR, BR, BL]
                    corners.sort(key=lambda c: math.hypot(c[0] - p1[0], c[1] - p1[1]) + math.hypot(p2[0] - c[0], p2[1] - c[1]))
                    detour.append(corners[0])
                    
                for dp in detour:
                    last = next_hull[-1]
                    if math.hypot(dp[0] - last[0], dp[1] - last[1]) > 8:
                        next_hull.append(dp)
                        
        current_hull = next_hull
        
    return current_hull

# Run with actual map 12 data
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
racks = [{"x": 98, "y": 1954, "width": 280, "height": 700}]
new_hull = avoid_racks_in_hull(hull, racks, 25)

print("Algoritmo executado com sucesso! Total de pontos no hull:", len(new_hull))
for i, p in enumerate(new_hull):
    print(f"  {i}: {p}")
