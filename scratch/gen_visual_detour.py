import math

def generate_svg():
    # Hull with detour
    new_hull = [
      (-689, 1457),
      (-394, 905),
      (-162, 905),
      (456, 909),
      (456, 1276),
      (406, 1935),
      (73, 1929),
      (73, 2434),
      (-107, 2434),
      (-339, 2434),
      (-636, 2134),
      (-689, 1824)
    ]
    
    # Generate bubble path with radius
    radius = 24
    n = len(new_hull)
    edgesNormals = []
    for i in range(n):
        p1 = new_hull[i]
        p2 = new_hull[(i + 1) % n]
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        dist = math.hypot(dx, dy)
        if dist < 1e-6:
            edgesNormals.append((0, 0))
        else:
            edgesNormals.append((dy / dist, -dx / dist))
            
    cmds = []
    for i in range(n):
        p = new_hull[i]
        prevIdx = (i - 1 + n) % n
        normIn = edgesNormals[prevIdx]
        normOut = edgesNormals[i]
        
        startX = round(p[0] + normIn[0] * radius, 1)
        startY = round(p[1] + normIn[1] * radius, 1)
        endX = round(p[0] + normOut[0] * radius, 1)
        endY = round(p[1] + normOut[1] * radius, 1)
        
        pNext = new_hull[(i + 1) % n]
        nextX = round(pNext[0] + normOut[0] * radius, 1)
        nextY = round(pNext[1] + normOut[1] * radius, 1)
        
        if i == 0:
            cmds.append(f"M {startX} {startY}")
        cmds.append(f"A {radius} {radius} 0 0 1 {endX} {endY}")
        cmds.append(f"L {nextX} {nextY}")
        
    cmds.append("Z")
    d = " ".join(cmds)
    
    html = f"""<!DOCTYPE html>
<html>
<body style="background:#030712; color:white; font-family:sans-serif; padding:20px;">
  <h2>Visualização do Contorno Adaptativo com Desvio do Rack 01</h2>
  <svg width="1400" height="1800" viewBox="-800 800 1400 1800" style="background:#0f172a; border:1px solid #334155; overflow:visible;">
    <!-- Rack 01 -->
    <rect x="98" y="1954" width="280" height="700" fill="#1e293b" stroke="#3b82f6" stroke-width="2" rx="12" />
    <text x="238" y="1990" fill="#60a5fa" text-anchor="middle" font-size="16" font-weight="bold">Rack 01</text>
    
    <!-- Bubble Path -->
    <path d="{d}" fill="rgba(59, 130, 246, 0.08)" stroke="#3b82f6" stroke-width="3" stroke-dasharray="8 6" />
    
    <!-- Members points -->
    <circle cx="230" cy="930" r="8" fill="#10b981" />
    <text x="230" y="915" fill="#10b981" font-size="12">Quarto 402</text>
    
    <circle cx="180" cy="1589" r="8" fill="#10b981" />
    <text x="180" y="1575" fill="#10b981" font-size="12">Quarto 406</text>
    
    <circle cx="-333" cy="2088" r="8" fill="#10b981" />
    <text x="-333" y="2075" fill="#10b981" font-size="12">Quarto 412</text>
  </svg>
</body>
</html>"""
    with open("scratch/test_visual_detour.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("Gerado scratch/test_visual_detour.html com sucesso!")

generate_svg()
