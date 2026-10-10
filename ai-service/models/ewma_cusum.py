import math
from typing import Optional, Dict, Any, Tuple

class EwmaCusumDetector:
    """
    Online EWMA baseline tracking and two-sided CUSUM detector for gradual drifts
    and level shifts in sensor streams (temperature or humidity).
    """

    def __init__(
        self,
        feature_name: str,
        target_min: Optional[float] = None,
        target_max: Optional[float] = None,
        alpha: float = 0.1,
        k_multiplier: float = 0.5,
        h_multiplier: float = 4.0,
    ):
        self.feature_name = feature_name
        self.alpha = alpha
        self.k_multiplier = k_multiplier
        self.h_multiplier = h_multiplier

        # Prior initialization from product profile bounds
        if target_min is not None and target_max is not None:
            self.mu = (target_min + target_max) / 2.0
            range_span = max(target_max - target_min, 1.0)
            self.variance = (range_span / 4.0) ** 2
            self.initialized = True
        else:
            self.mu = 0.0
            self.variance = 1.0
            self.initialized = False

        self.sigma = math.sqrt(self.variance)
        self.k = self.k_multiplier * max(self.sigma, 0.2)
        self.h = self.h_multiplier * max(self.sigma, 0.2)
        self.s_pos = 0.0
        self.s_neg = 0.0
        self.count = 0

    def update(self, value: float, weight: float = 1.0) -> Tuple[bool, float, str, str]:
        """
        Updates EWMA baseline and CUSUM statistics with a new sensor reading.
        Returns: (is_drift, anomaly_score, severity, explanation)
        """
        self.count += 1

        if not self.initialized:
            self.mu = value
            self.variance = 1.0
            self.sigma = 1.0
            self.k = self.k_multiplier * self.sigma
            self.h = self.h_multiplier * self.sigma
            self.initialized = True
            return False, 0.0, "info", "Initialized baseline"

        # Effective learning rate adjusted by sample weight (downweighting support)
        effective_alpha = self.alpha * max(0.0, min(1.0, weight))

        # Update EWMA mean and variance
        diff = value - self.mu
        self.mu += effective_alpha * diff
        self.variance = (1.0 - effective_alpha) * self.variance + effective_alpha * (diff ** 2)
        self.sigma = math.sqrt(max(self.variance, 1e-6))

        # Dynamically adjust CUSUM parameters based on observed sigma
        self.k = self.k_multiplier * max(self.sigma, 0.2)
        self.h = self.h_multiplier * max(self.sigma, 0.2)

        # Update CUSUM statistics
        if weight > 0.0:
            self.s_pos = max(0.0, self.s_pos + diff - self.k)
            self.s_neg = max(0.0, self.s_neg - diff - self.k)

        # Check drift breach
        if self.s_pos > self.h:
            ratio = self.s_pos / self.h
            score = min(0.99, 0.5 + 0.25 * ratio)
            severity = "critical" if ratio > 2.0 else "warning"
            explanation = (
                f"Positive drift detected in {self.feature_name}: persistent increase "
                f"(current: {value:.2f}, baseline: {self.mu:.2f}, CUSUM: {self.s_pos:.2f} > {self.h:.2f})"
            )
            return True, score, severity, explanation

        if self.s_neg > self.h:
            ratio = self.s_neg / self.h
            score = min(0.99, 0.5 + 0.25 * ratio)
            severity = "critical" if ratio > 2.0 else "warning"
            explanation = (
                f"Negative drift detected in {self.feature_name}: persistent decrease "
                f"(current: {value:.2f}, baseline: {self.mu:.2f}, CUSUM: {self.s_neg:.2f} > {self.h:.2f})"
            )
            return True, score, severity, explanation

        return False, 0.0, "info", "Normal fluctuation"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "feature_name": self.feature_name,
            "mu": self.mu,
            "variance": self.variance,
            "sigma": self.sigma,
            "s_pos": self.s_pos,
            "s_neg": self.s_neg,
            "alpha": self.alpha,
            "k_multiplier": self.k_multiplier,
            "h_multiplier": self.h_multiplier,
            "k": self.k,
            "h": self.h,
            "initialized": self.initialized,
            "count": self.count,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "EwmaCusumDetector":
        inst = cls(
            feature_name=data["feature_name"],
            alpha=data.get("alpha", 0.1),
            k_multiplier=data.get("k_multiplier", 0.5),
            h_multiplier=data.get("h_multiplier", 4.0),
        )
        inst.mu = data["mu"]
        inst.variance = data["variance"]
        inst.sigma = data["sigma"]
        inst.s_pos = data["s_pos"]
        inst.s_neg = data["s_neg"]
        inst.k = data["k"]
        inst.h = data["h"]
        inst.initialized = data["initialized"]
        inst.count = data.get("count", 0)
        return inst
