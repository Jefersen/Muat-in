from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import math

app = FastAPI(
    title="Muat-In AI & Math Engine",
    description="3D Bin Packing, Center of Gravity, and ODOL Risk evaluation microservice",
    version="1.0.0"
)

# ==========================================
# DATA MODELS (DTOs)
# ==========================================

class ItemInput(BaseModel):
    id: str
    code: str
    name: str
    length_cm: float
    width_cm: float
    height_cm: float
    weight_kg: float
    category: str  # HEAVY, MEDIUM, LIGHT
    quantity: int

class TruckInput(BaseModel):
    id: str
    name: str
    plate_number: str
    length_cm: float
    width_cm: float
    height_cm: float
    max_weight_kg: float
    max_volume_cbm: float

class PackRequest(BaseModel):
    truck: TruckInput
    items: List[ItemInput]
    all_trucks: List[TruckInput]

# ==========================================
# 3D BIN PACKING ALGORITHM
# ==========================================

def pack_items(truck: TruckInput, items: List[ItemInput]):
    # Flatten items by quantity
    flat_boxes = []
    for item in items:
        for _ in range(item.quantity):
            flat_boxes.append({
                "item_id": item.id,
                "code": item.code,
                "name": item.name,
                "length_cm": item.length_cm,
                "width_cm": item.width_cm,
                "height_cm": item.height_cm,
                "weight_kg": item.weight_kg,
                "category": item.category
            })

    # Sort boxes:
    # 1. HEAVY (density/stability first), then MEDIUM, then LIGHT
    # 2. Volume in descending order
    category_order = {"HEAVY": 0, "MEDIUM": 1, "LIGHT": 2}
    flat_boxes.sort(key=lambda b: (
        category_order.get(b["category"], 2),
        -(b["length_cm"] * b["width_cm"] * b["height_cm"])
    ))

    placed_boxes = []
    unplaced_boxes = []

    # Candidates list represents back-left-bottom (X, Y, Z) corners
    # Starts at (0,0,0) - bottom back-left corner
    candidates = [(0.0, 0.0, 0.0)]

    for box in flat_boxes:
        placed = False
        
        # Sort candidates to prioritize:
        # 1. Lower height (Z) - pack bottom layers first
        # 2. Deeper depth (X) - pack back of the truck first
        # 3. Leftmost width (Y) - pack left to right
        candidates.sort(key=lambda c: (c[2], c[0], c[1]))

        for cand in candidates:
            cx, cy, cz = cand

            # Try horizontal rotations (Rotation 0: normal, Rotation 1: swapped length/width)
            for rot in [0, 1]:
                if rot == 0:
                    bl, bw = box["length_cm"], box["width_cm"]
                else:
                    bl, bw = box["width_cm"], box["length_cm"]
                bh = box["height_cm"]

                # 1. Check boundary constraints
                if cx + bl > truck.length_cm:
                    continue
                if cy + bw > truck.width_cm:
                    continue
                if cz + bh > truck.height_cm:
                    continue

                # 2. Overlap collision check
                overlap = False
                new_box_temp = {"x": cx, "y": cy, "z": cz, "l": bl, "w": bw, "h": bh}
                for pb in placed_boxes:
                    # Check if 3D boxes intersect
                    if not (
                        new_box_temp["x"] + new_box_temp["l"] <= pb["x_pos"] or
                        pb["x_pos"] + pb["length"] <= new_box_temp["x"] or
                        new_box_temp["y"] + new_box_temp["w"] <= pb["y_pos"] or
                        pb["y_pos"] + pb["width"] <= new_box_temp["y"] or
                        new_box_temp["z"] + new_box_temp["h"] <= pb["z_pos"] or
                        pb["z_pos"] + pb["height"] <= new_box_temp["z"]
                    ):
                        overlap = True
                        break

                if overlap:
                    continue

                # 3. Support/Gravity check (for boxes placed off the floor)
                if cz > 0:
                    # Must overlap with top face of at least one placed box below it
                    supported = False
                    for pb in placed_boxes:
                        # Top of pb matches bottom of new box
                        if abs((pb["z_pos"] + pb["height"]) - cz) < 0.1:
                            # Check horizontal overlap
                            x_overlap = max(0, min(cx + bl, pb["x_pos"] + pb["length"]) - max(cx, pb["x_pos"]))
                            y_overlap = max(0, min(cy + bw, pb["y_pos"] + pb["width"]) - max(cy, pb["y_pos"]))
                            if x_overlap > 0 and y_overlap > 0:
                                supported = True
                                break
                    if not supported:
                        continue

                # If all checks pass, place the box
                placed_box = {
                    "item_id": box["item_id"],
                    "code": box["code"],
                    "name": box["name"],
                    "x_pos": cx,
                    "y_pos": cy,
                    "z_pos": cz,
                    "length": bl,
                    "width": bw,
                    "height": bh,
                    "rotation_state": rot,
                    "is_placed": True,
                    "weight_kg": box["weight_kg"],
                    "weight_category": "heavy_red" if box["category"] == "HEAVY" else ("medium_yellow" if box["category"] == "MEDIUM" else "light_green")
                }
                placed_boxes.append(placed_box)

                # Remove current candidate and add new potential corner points
                if cand in candidates:
                    candidates.remove(cand)
                
                # New candidates generated around the placed box edges
                candidates.append((cx + bl, cy, cz))
                candidates.append((cx, cy + bw, cz))
                candidates.append((cx, cy, cz + bh))
                
                placed = True
                break
            
            if placed:
                break
        
        if not placed:
            unplaced_boxes.append({
                "item_id": box["item_id"],
                "code": box["code"],
                "name": box["name"],
                "length": box["length_cm"],
                "width": box["width_cm"],
                "height": box["height_cm"],
                "weight_kg": box["weight_kg"],
                "is_placed": False,
                "weight_category": "heavy_red" if box["category"] == "HEAVY" else ("medium_yellow" if box["category"] == "MEDIUM" else "light_green")
            })

    return placed_boxes, unplaced_boxes

# ==========================================
# ENDPOINT IMPLEMENTATION
# ==========================================

@app.get("/")
def health_check():
    return {
        "status": "healthy",
        "service": "muat-in-ai-engine",
        "version": "1.0.0"
    }

@app.post("/plans/calculate")
def calculate_load_plan(req: PackRequest):
    truck = req.truck
    items = req.items
    all_trucks = req.all_trucks

    # 1. Run 3D Bin Packing
    placed_boxes, unplaced_boxes = pack_items(truck, items)

    # 2. Calculate Utilizations
    total_weight = sum(b["weight_kg"] for b in placed_boxes)
    truck_volume = truck.length_cm * truck.width_cm * truck.height_cm
    total_volume_cm3 = sum(b["length"] * b["width"] * b["height"] for b in placed_boxes)
    total_volume_cbm = total_volume_cm3 / 1_000_000.0

    weight_utilization_pct = (total_weight / truck.max_weight_kg) * 100.0
    volume_utilization_pct = (total_volume_cm3 / truck_volume) * 100.0

    # 3. Center of Gravity (CoG) Math
    if total_weight > 0:
        cog_x = sum((b["x_pos"] + b["length"] / 2.0) * b["weight_kg"] for b in placed_boxes) / total_weight
        cog_y = sum((b["y_pos"] + b["width"] / 2.0) * b["weight_kg"] for b in placed_boxes) / total_weight
        cog_z = sum((b["z_pos"] + b["height"] / 2.0) * b["weight_kg"] for b in placed_boxes) / total_weight
    else:
        cog_x = truck.length_cm / 2.0
        cog_y = truck.width_cm / 2.0
        cog_z = 0.0

    # 4. ODOL & Safety Analysis
    odol_risk_status = "SAFE"
    messages = []
    is_overweight = False
    is_overdimension = False

    # Overweight check
    if total_weight > truck.max_weight_kg:
        odol_risk_status = "DANGER"
        is_overweight = True
        messages.append(f"OVERWEIGHT: Total berat muatan ({total_weight:.1f} kg) melebihi kapasitas truk ({truck.max_weight_kg:.1f} kg)!")
    elif weight_utilization_pct > 90.0:
        messages.append("WARNING: Muatan berat hampir penuh (>90%).")

    # Overdimension / Fit check
    if len(unplaced_boxes) > 0:
        odol_risk_status = "DANGER"
        is_overdimension = True
        messages.append(f"OVERDIMENSION: Sebanyak {len(unplaced_boxes)} barang tidak muat dalam dimensi truk saat ini.")

    # Left-Right Imbalance check (potensi oleng)
    # Ideal Y CoG is truck width / 2. Allowable deviation is 10% of width
    center_y = truck.width_cm / 2.0
    deviation_y = abs(cog_y - center_y)
    max_deviation_y = truck.width_cm * 0.10
    if deviation_y > max_deviation_y:
        odol_risk_status = "DANGER" if odol_risk_status != "DANGER" else "DANGER"
        side = "Kanan" if cog_y > center_y else "Kiri"
        messages.append(f"POTENSI OLENG: Distribusi berat miring ke arah {side} (Penyimpangan CoG: {deviation_y:.1f} cm).")

    # Front-Back Imbalance check
    center_x = truck.length_cm / 2.0
    deviation_x = cog_x - center_x
    if abs(deviation_x) > (truck.length_cm * 0.15):
        pos = "Depan" if deviation_x > 0 else "Belakang"
        messages.append(f"WARNING: Beban kurang seimbang, condong ke {pos}.")

    if not messages:
        messages.append("Beban muatan aman dan seimbang.")

    # 5. Alternate Truck Recommendation Engine
    recommendation = {
        "is_recommended": True,
        "message": "Armada saat ini sesuai untuk kapasitas barang.",
        "alternative_trucks": []
    }

    if is_overweight or is_overdimension:
        recommendation["is_recommended"] = False
        
        # Calculate total payload requirements
        all_items_weight = sum(item.weight_kg * item.quantity for item in items)
        all_items_volume = sum((item.length_cm * item.width_cm * item.height_cm * item.quantity) for item in items) / 1_000_000.0

        valid_trucks = []
        for t in all_trucks:
            if t.id == truck.id:
                continue
            
            # Rough initial check: capacity must fit total weight and volume
            if t.max_weight_kg >= all_items_weight and t.max_volume_cbm >= all_items_volume:
                # Run packing test on this truck
                test_placed, test_unplaced = pack_items(t, items)
                if len(test_unplaced) == 0:
                    valid_trucks.append({
                        "id": t.id,
                        "name": t.name,
                        "plate_number": t.plate_number,
                        "max_weight_kg": t.max_weight_kg,
                        "max_volume_cbm": t.max_volume_cbm
                    })

        # Sort alternative trucks by capacity size (smallest first)
        valid_trucks.sort(key=lambda t: t["max_weight_kg"])

        if valid_trucks:
            recommendation["message"] = f"Gunakan armada alternatif yang lebih besar: {valid_trucks[0]['name']} ({valid_trucks[0]['plate_number']})."
            recommendation["alternative_trucks"] = valid_trucks
        else:
            recommendation["message"] = "Muatan terlalu besar. Pecah barang muatan menjadi 2 armada pengiriman."

    # Return consolidated calculation response
    return {
        "utilization": {
          "weight_pct": round(weight_utilization_pct, 2),
          "volume_pct": round(volume_utilization_pct, 2),
          "total_weight_kg": round(total_weight, 2),
          "total_volume_cbm": round(total_volume_cbm, 2)
        },
        "center_of_gravity": {
          "cog_x": round(cog_x, 2),
          "cog_y": round(cog_y, 2),
          "cog_z": round(cog_z, 2)
        },
        "odol_risk": {
          "status": odol_risk_status,
          "messages": messages,
          "is_overweight": is_overweight,
          "is_overdimension": is_overdimension
        },
        "truck_recommendation": recommendation,
        "packed_items": placed_boxes,
        "unpacked_items": unplaced_boxes
    }
