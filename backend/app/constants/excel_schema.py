REQUIRED_COLUMNS: list[str] = [
    "NO",
    "CODE",
    "LENGTH",
    "WIDTH",
    "QUANTITY",
    "GRAIN",
    "TOP_EDGE",
    "BOTTOM_EDGE",
    "LEFT_EDGE",
    "RIGHT_EDGE",
]

VALID_GRAIN_VALUES: list[str] = [
    "0-Material",
    "1-Boyuna",
    "2-Enine",
    "3-Material",
]

PART_GROUPS: list[str] = ["GOVDE", "ARKALIK"]

COLUMN_DTYPES: dict[str, str] = {
    "NO": "int",
    "LENGTH": "float",
    "WIDTH": "float",
    "QUANTITY": "int",
    "GRAIN": "str",
}

ARKALIK_FORBIDDEN_COLUMNS: list[str] = [
    "TOP_EDGE",
    "BOTTOM_EDGE",
    "LEFT_EDGE",
    "RIGHT_EDGE",
]

# Grain string to numeric index mapping for export
# 0-Material → 0, 1-Boyuna → 1, 2-Enine → 2, 3-Material → 3
GRAIN_MAP: dict[str, int] = {value: index for index, value in enumerate(VALID_GRAIN_VALUES)}

# Legacy grain format mapping for backward compatibility
# Maps old format (1-Material, 2-Material, 3-Mixed) to current format (1-Boyuna, 2-Enine, 3-Material)
LEGACY_GRAIN_MAP: dict[str, str] = {
    "1-Material": "1-Boyuna",
    "2-Material": "2-Enine",
    "3-Mixed": "3-Material",
}
