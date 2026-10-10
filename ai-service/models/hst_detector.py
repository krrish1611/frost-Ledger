import pickle
import base64
from typing import Dict, Any, Tuple
from river.anomaly import HalfSpaceTrees

class HalfSpaceTreesDetector:
    """
    Multivariate streaming anomaly detector using River's Half-Space Trees.
    Evaluates joint probability distribution of (temperature, humidity, shock, speed).
    """

    def __init__(
        self,
        n_trees: int = 25,
        height: int = 6,
        window_size: int = 50,
        anomaly_threshold: float = 0.65,
        seed: int = 42,
    ):
        self.n_trees = n_trees
        self.height = height
        self.window_size = window_size
        self.anomaly_threshold = anomaly_threshold
        self.seed = seed
        self.count = 0

        self.model = HalfSpaceTrees(
            n_trees=self.n_trees,
            height=self.height,
            window_size=self.window_size,
            seed=self.seed,
        )

    def evaluate_and_learn(
        self,
        features: Dict[str, float],
        weight: float = 1.0,
    ) -> Tuple[bool, float, str, str]:
        """
        Calculates multivariate anomaly score and trains the online trees.
        Returns: (is_anomaly, score, severity, explanation)
        """
        self.count += 1
        raw_score = self.model.score_one(features)

        # Train model if sample weight > 0
        if weight > 0.0:
            self.model.learn_one(features)

        # Score is in [0, 1]
        score = float(raw_score)

        if score >= self.anomaly_threshold:
            severity = "critical" if score >= 0.85 else "warning"
            feat_desc = ", ".join(f"{k}={v:.1f}" for k, v in features.items())
            explanation = (
                f"Multivariate sensor anomaly detected by Half-Space Trees: score {score:.2f} "
                f"exceeds threshold {self.anomaly_threshold:.2f} ({feat_desc})"
            )
            return True, score, severity, explanation

        return False, score, "info", "Multivariate reading within normal distribution"

    def to_dict(self) -> Dict[str, Any]:
        pickled_model = pickle.dumps(self.model)
        b64_model = base64.b64encode(pickled_model).decode("utf-8")
        return {
            "n_trees": self.n_trees,
            "height": self.height,
            "window_size": self.window_size,
            "anomaly_threshold": self.anomaly_threshold,
            "seed": self.seed,
            "count": self.count,
            "model_b64": b64_model,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "HalfSpaceTreesDetector":
        inst = cls(
            n_trees=data.get("n_trees", 25),
            height=data.get("height", 6),
            window_size=data.get("window_size", 50),
            anomaly_threshold=data.get("anomaly_threshold", 0.65),
            seed=data.get("seed", 42),
        )
        inst.count = data.get("count", 0)
        if "model_b64" in data:
            raw_bytes = base64.b64decode(data["model_b64"].encode("utf-8"))
            inst.model = pickle.loads(raw_bytes)
        return inst
