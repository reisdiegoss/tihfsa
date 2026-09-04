p1 = (406, 1935)
p2 = (-107, 2434)
rx1 = 73
rx2 = 403
ry1 = 1929
ry2 = 2679

for s in range(1, 40):
    t = s / 40.0
    x = p1[0] + t * (p2[0] - p1[0])
    y = p1[1] + t * (p2[1] - p1[1])
    in_box = (rx1 < x < rx2) and (ry1 < y < ry2)
    if in_box:
        print(f"Sample {s}: t={t:.2f}, x={x:.1f}, y={y:.1f} -> DENTRO!")
        break
