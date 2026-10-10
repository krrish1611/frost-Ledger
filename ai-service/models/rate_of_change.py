from datetime import datetime
from typing import Optional, Dict, Any, Tuple

class RateOfChangeDetector:
    """
    Detects sudden spikes and rapid rates of change between consecutive pings.
    """

    def __init__(
        self,
        max_temp_rate_c_per_min: float = 1.5,
        max_humidity_rate_pct_per_min: float = 15.0,
    ):
        self.max_temp_rate = max_temp_rate_c_per_min
        self.max_humidity_rate = max_humidity_rate_pct_per_min

        self.last_timestamp: Optional[str] = None
        self.last_temp: Optional[float] = None
        self.last_humidity: Optional[float] = None

    def update(
        self, timestamp_iso: str, temp: float, humidity: float
    ) -> Tuple[bool, float, str, str]:
        """
        Calculates rate of change between the current and previous reading.
        Returns: (is_spike, anomaly_score, severity, explanation)
        """
        try:
            curr_dt = datetime.fromisoformat(timestamp_iso.replace("Z", "+00:00"))
        except Exception:
            curr_dt = datetime.utcnow()

        if self.last_timestamp is None or self.last_temp is None or self.last_humidity is None:
            self.last_timestamp = timestamp_iso
            self.last_temp = temp
            self.last_humidity = humidity
            return False, 0.0, "info", "Initial reading recorded"

        try:
            prev_dt = datetime.fromisoformat(self.last_timestamp.replace("Z", "+00:00"))
            delta_seconds = abs((curr_dt - prev_dt).total_seconds())
        except Exception:
            delta_seconds = 60.0

        # Avoid divide-by-zero for sub-second pings; minimum interval 10 seconds
        delta_minutes = max(delta_seconds / 60.0, 0.1667)

        temp_diff = temp - self.last_temp
        temp_rate = abs(temp_diff) / delta_minutes

        humidity_diff = humidity - self.last_humidity
        humidity_rate = abs(humidity_diff) / delta_minutes

        # Update last values
        self.last_timestamp = timestamp_iso
        self.last_temp = temp
        self.last_humidity = humidity

        if temp_rate > self.max_temp_rate:
            severity = "critical" if temp_rate > (2.5 * self.max_temp_rate) else "warning"
            score = min(0.99, 0.6 + 0.3 * (temp_rate / (2.0 * self.max_temp_rate)))
            explanation = (
                f"Rapid temperature jump detected: {temp_diff:+.2f}°C in {delta_minutes:.1f} min "
                f"({temp_rate:.2f}°C/min exceeds threshold {self.max_temp_rate:.2f}°C/min)"
            )
            return True, score, severity, explanation

        if humidity_rate > self.max_humidity_rate:
            severity = "warning"
            score = min(0.95, 0.5 + 0.25 * (humidity_rate / (2.0 * self.max_humidity_rate)))
            explanation = (
                f"Rapid humidity shift detected: {humidity_diff:+.1f}% RH in {delta_minutes:.1f} min "
                f"({humidity_rate:.1f}%/min exceeds threshold {self.max_humidity_rate:.1f}%/min)"
            )
            return True, score, severity, explanation

        return False, 0.0, "info", "Rate of change within acceptable parameters"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "max_temp_rate": self.max_temp_rate,
            "max_humidity_rate": self.max_humidity_rate,
            "last_timestamp": self.last_timestamp,
            "last_temp": self.last_temp,
            "last_humidity": self.last_humidity,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RateOfChangeDetector":
        inst = cls(
            max_temp_rate_c_per_min=data.get("max_temp_rate", 1.5),
            max_humidity_rate_pct_per_min=data.get("max_humidity_rate", 15.0),
        )
        inst.last_timestamp = data.get("last_timestamp")
        inst.last_temp = data.get("last_temp")
        inst.last_humidity = data.get("last_humidity")
        return inst
