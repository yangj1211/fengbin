"""Extract Scenario 2 tables and copy their unmodified source files for the demo.

Run with the bundled workspace Python. The workbooks are only read; all output
is written beneath poc-demo. Re-running this script is deterministic.
"""

from datetime import date, datetime
from hashlib import sha256
import json
from pathlib import Path
import shutil

from openpyxl import load_workbook
from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = PROJECT_ROOT.parent / "整理后数据" / "场景2_数据"
ASSET_ROOT = PROJECT_ROOT / "public" / "data" / "maintenance" / "final"
JSON_PATH = PROJECT_ROOT / "app" / "application" / "maintenance-final.json"
URL_ROOT = "/data/maintenance/final"
TABLE_FILES = (
    ("maintenance-faults", "故障表.xlsx"),
    ("maintenance-plans", "故障处理方案表.xlsx"),
    ("maintenance-standards", "操作标准表.xlsx"),
    ("maintenance-parts-final", "备件表.xlsx"),
)


def serialize_cell(value):
    if isinstance(value, (datetime, date)):
        return value.strftime("%Y-%m-%d")
    return value


def copy_verified(source):
    destination = ASSET_ROOT / source.name
    shutil.copy2(source, destination)
    source_digest = sha256(source.read_bytes()).hexdigest()
    destination_digest = sha256(destination.read_bytes()).hexdigest()
    if source_digest != destination_digest:
        raise ValueError(f"Source copy differs: {source.name}")
    return {"fileName": source.name, "sha256": source_digest}


def main():
    ASSET_ROOT.mkdir(parents=True, exist_ok=True)
    tables = []
    verified_files = []
    for table_id, file_name in TABLE_FILES:
        source = SOURCE_ROOT / file_name
        workbook = load_workbook(source, read_only=True, data_only=True)
        if len(workbook.worksheets) != 1:
            raise ValueError(f"Expected one source sheet: {file_name}")
        sheet = workbook.worksheets[0]
        values = list(sheet.values)
        tables.append({
            "id": table_id,
            "fileName": file_name,
            "sheetName": sheet.title,
            "url": f"{URL_ROOT}/{file_name}",
            "columns": list(values[0]),
            # Preserve every row so array index + 2 is the real Excel row.
            "rows": [[serialize_cell(cell) for cell in row] for row in values[1:]],
        })
        workbook.close()
        verified_files.append(copy_verified(source))

    images = []
    for source in sorted((SOURCE_ROOT / "图片").glob("*.jpeg")):
        with Image.open(source) as image:
            width, height = image.size
        images.append({
            "faultId": source.stem,
            "fileName": source.name,
            "url": f"{URL_ROOT}/{source.name}",
            "width": width,
            "height": height,
        })
        verified_files.append(copy_verified(source))

    fault_ids = {row[0] for row in tables[0]["rows"]}
    image_ids = {image["faultId"] for image in images}
    if fault_ids != image_ids:
        raise ValueError("Fault and image IDs do not match")
    if any(row[1] not in fault_ids for row in tables[1]["rows"]):
        raise ValueError("A repair plan refers to an unknown fault")
    if any(row[5] != f"{row[0]}.jpeg" for row in tables[0]["rows"]):
        raise ValueError("Fault image filename differs from its source image")

    result = {"version": "final-20260914", "tables": tables, "images": images}
    JSON_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    # Verify JSON preserves all source values after date serialization.
    if json.loads(JSON_PATH.read_text()) != result:
        raise ValueError("JSON round-trip differs from the extracted source")
    print(json.dumps({
        "tables": [{"fileName": table["fileName"], "rows": len(table["rows"]),
                    "columns": table["columns"]} for table in tables],
        "imageCount": len(images),
        "verifiedCopies": verified_files,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
