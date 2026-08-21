"""Severity mapping from risk_score buckets (design D8).

Buckets (0.00-1.00):
    low      [0.00, 0.33)
    medium   [0.33, 0.66)
    high     [0.66, 0.85)
    critical [0.85, 1.00]
A risk_score of 0 (default) is considered low.
"""

BUCKETS = (
    ("low", 0.0, 0.33),
    ("medium", 0.33, 0.66),
    ("high", 0.66, 0.85),
    ("critical", 0.85, 1.0001),
)

VALID_SEVERITIES = tuple(b[0] for b in BUCKETS)


def severity_for(score) -> str:
    """Map a numeric risk_score to its severity bucket."""
    if score is None:
        return "low"
    value = float(score)
    for name, low, high in BUCKETS:
        if low <= value < high:
            return name
    return "critical"


def bucket_range(severity) -> tuple[float, float] | None:
    """Return the [low, high) numeric range for a severity name."""
    for name, low, high in BUCKETS:
        if name == severity:
            return low, high
    return None