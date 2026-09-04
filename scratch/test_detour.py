import math

# Simulação da função de desvio de obstáculo (Rack Avoidance)
def avoid_racks_in_hull(hull, racks, margin=25):
    new_hull = []
    n = len(hull)
    
    for i in range(n):
        p1 = hull[i]
        p2 = hull[(i + 1) % n]
        
        # Check against all racks
        detour_points = []
        for r in racks:
            rw = r.get("width") or 280
            rh = r.get("height") or 700
            rx1 = r["x"] - margin
            rx2 = r["x"] + rw + margin
            ry1 = r["y"] - margin
            ry2 = r["y"] + rh + margin
            
            # Check if segment p1 -> p2 intersects rack box
            # Sample along segment
            steps = 40
            intersects = False
            for s in range(1, steps):
                t = s / steps
                x = p1[0] + t * (p2[0] - p1[0])
                y = p1[1] + t * (p2[1] - p1[1])
                if rx1 < x < rx2 and ry1 < y < ry2:
                    intersects = True
                    break
            
            if intersects:
                # Need detour around rack box
                # Determine which corners to use based on p1 and p2 relative to box
                # p1 is near top-right/above, p2 is left/below
                # Corners:
                TL = (rx1, ry1)
                TR = (rx2, ry1)
                BL = (rx1, ry2)
                BR = (rx2, ry2)
                
                # Check candidate paths:
                # Path A (contour via TL): p1 -> (clamp(p1.x, rx1, rx2), ry1) -> TL -> (rx1, clamp(p2.y, ry1, ry2)) -> p2
                # Path B (contour via BR): p1 -> TR -> BR -> (clamp(p2.x, rx1, rx2), ry2) -> p2
                
                # For clockwise hull going from right/top to left/bottom:
                # TL path keeps rack to the outside (left of polygon)
                # Let's check distance and orientation
                path_TL = []
                if p1[1] <= ry1: # above rack
                    if p1[0] > rx1:
                        path_TL.append((min(p1[0], rx2), ry1))
                    path_TL.append(TL)
                else:
                    path_TL.append(TL)
                
                if p2[1] > ry1:
                    path_TL.append((rx1, min(p2[1], ry2)))
                
                detour_points = path_TL
                break
        
        new_hull.append(p1)
        for dp in detour_points:
            # avoid duplicates
            if math.hypot(dp[0] - new_hull[-1][0], dp[1] - new_hull[-1][1]) > 5:
                new_hull.append(dp)
                
    return new_hull

# Test with our real points
hull = [
  (-689, 1457),
  (-394, 905),
  (-162, 905),
  (456, 909),
  (456, 1276),
  (406, 1935),
  (-107, 2434),
  (-339, 2434),
  (-636, 2134),
  (-689, 1824)
]

racks = [{"x": 98, "y": 1954, "width": 280, "height": 700}]

new_hull = avoid_racks_in_hull(hull, racks)
print("Novo Hull com Desvio do Rack 01:")
for i, p in enumerate(new_hull):
    p_next = new_hull[(i + 1) % len(new_hull)]
    print(f"  {i}: {p} -> {p_next}")
