from typing import List, Dict, Any, Tuple, Optional

class RuleDetector:
    """
    Deterministic/heuristic rule detectors for IoT edge threats:
    1. Flat / copied readings (sensor stuck or replay spoofing)
    2. Vehicle stopped too long during transit
    """

    def __init__(
        self,
        flat_window_size: int = 5,
        max_stationary_readings: int = 20,
    ):
        self.flat_window_size = flat_window_size
        self.max_stationary_readings = max_stationary_readings

        self.recent_temps: List[float] = []
        self.recent_humidities: List[float] = []
        self.stationary_count: int = 0

    def check_flat_copied(self, temp: float, humidity: float) -> Tuple[bool, float, str, str]:
        """
        Detects if sensor values are unnaturally constant across consecutive pings.
        """
        self.recent_temps.append(temp)
        self.recent_humidities.append(humidity)

        if len(self.recent_temps) > self.flat_window_size:
            self.recent_temps.pop(0)
            self.recent_humidities.pop(0)

        if len(self.recent_temps) >= self.flat_window_size:
            # Check if all temperatures are identical down to 0.0001
            temp_spread = max(self.recent_temps) - min(self.recent_temps)
            hum_spread = max(self.recent_humidities) - min(self.recent_humidities)

            if temp_spread < 1e-4 and hum_spread < 1e-4:
                return (
                    True,
                    0.88,
                    "warning",
                    f"Flat / copied sensor readings detected: temperature ({temp:.2f}°C) and humidity ({humidity:.1f}%) "
                    f"show 0.00 variance across {self.flat_window_size} consecutive batches (potential sensor fault or spoofing)."
                )

        return False, 0.0, "info", "Sensor readings show natural variance"

    def check_vehicle_stopped(
        self,
        speed: Optional[float],
        is_temp_rising: bool,
    ) -> Tuple[bool, float, str, str]:
        """
        Detects if vehicle has remained stationary for too long while temperature is rising.
        """
        if speed is not None and speed < 1.0:
            self.stationary_count += 1
        else:
            self.stationary_count = 0

        if self.stationary_count >= self.max_stationary_readings and is_temp_rising:
            return (
                True,
                0.75,
                "warning",
                f"Vehicle stationary for {self.stationary_count} consecutive intervals while internal "
                f"cargo temperature is rising towards ambient."
            )

        return False, 0.0, "info", "Vehicle movement normal"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "flat_window_size": self.flat_window_size,
            "max_stationary_readings": self.max_stationary_readings,
            "recent_temps": list(self.recent_temps),
            "recent_humidities": list(self.recent_humidities),
            "stationary_count": self.stationary_count,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RuleDetector":
        inst = cls(
            flat_window_size=data.get("flat_window_size", 5),
            max_stationary_readings=data.get("max_stationary_readings", 20),
        )
        inst.recent_temps = list(data.get("recent_temps", []))
        inst.recent_humidities = list(data.get("recent_humidities", []))
        inst.stationary_count = data.get("stationary_count", 0)
        return inst
