#!/usr/bin/env python3
"""
FrostLedger Specialized AI Model Training Pipeline
Trains two separate models with distinct biological and physical constraints:
  1. Vaccine & Biologics Cold-Chain Model
  2. Fruits & Vegetables (Fresh Produce) Cold-Chain Model
"""

import os
import math
import json
import numpy as np
from datetime import datetime, timezone
from sklearn.metrics import precision_score, recall_score, f1_score, accuracy_score

from models.cargo_models import VaccineColdChainModel, ProduceColdChainModel

TRAINED_DIR = os.path.join(os.path.dirname(__file__), "models", "trained")
os.makedirs(TRAINED_DIR, exist_ok=True)

def generate_vaccine_training_data(n_samples: int = 1500, random_state: int = 42):
    """
    Generates synthetic vaccine cold-chain telemetry following WHO biologics specifications.
    Normal: +2.0°C to +8.0°C (mean 4.8°C), low shock (< 1.0g), smooth transit.
    Anomalies: Freezing violations (<= 0.0°C), thermal degradation (> 8.0°C), vial shock (> 2.5g).
    """
    rng = np.random.RandomState(random_state)
    records = []
    y_labels = []

    for i in range(n_samples):
        r_type = rng.rand()
        if r_type < 0.70: # 70% Normal in-spec transit
            temp = float(rng.normal(4.8, 0.7))
            temp = np.clip(temp, 2.2, 7.8)
            hum = float(rng.normal(50.0, 5.0))
            shock = float(rng.exponential(0.3))
            speed = float(rng.uniform(30.0, 90.0))
            label = 0 # Normal
        elif r_type < 0.82: # 12% Heat excursion (> 8.0°C)
            temp = float(rng.uniform(8.5, 18.0))
            hum = float(rng.normal(60.0, 8.0))
            shock = float(rng.exponential(0.4))
            speed = float(rng.uniform(20.0, 75.0))
            label = 1 # Anomaly
        elif r_type < 0.92: # 10% Freezing breach (<= 0.5°C)
            temp = float(rng.uniform(-5.0, 0.5))
            hum = float(rng.normal(45.0, 6.0))
            shock = float(rng.exponential(0.3))
            speed = float(rng.uniform(40.0, 80.0))
            label = 1 # Anomaly
        else: # 8% Physical shock impact (> 2.5g, vial shear/break risk)
            temp = float(rng.uniform(3.5, 6.5))
            hum = float(rng.normal(50.0, 5.0))
            shock = float(rng.uniform(2.6, 6.0))
            speed = float(rng.uniform(0.0, 45.0))
            label = 1 # Anomaly

        records.append({
            "temperature": temp,
            "humidity": hum,
            "shock": shock,
            "speed": speed,
        })
        y_labels.append(label)

    return records, np.array(y_labels)


def generate_produce_training_data(n_samples: int = 1500, random_state: int = 42):
    """
    Generates synthetic fresh produce telemetry following USDA Handbook 66 standards.
    Normal: 0.5°C to 3.5°C, high RH (88% - 95%), low vibration (< 1.2g).
    Anomalies: Transpiration dry-out (RH < 75%), condensation / Botrytis mold (RH > 96% with chill drop),
               cellular freezing (< -0.5°C), bruising impact (> 1.8g), Q10 thermal decay (> 6.0°C).
    """
    rng = np.random.RandomState(random_state)
    records = []
    y_labels = []

    for i in range(n_samples):
        r_type = rng.rand()
        if r_type < 0.68: # 68% Normal produce transit (optimal fresh preservation)
            temp = float(rng.normal(2.0, 0.6))
            temp = np.clip(temp, 0.3, 3.8)
            hum = float(rng.uniform(88.0, 94.5))
            shock = float(rng.exponential(0.25))
            label = 0
        elif r_type < 0.78: # 10% Transpiration dry-out (low humidity, wilting)
            temp = float(rng.uniform(1.0, 4.0))
            hum = float(rng.uniform(55.0, 75.0)) # low RH causes moisture loss
            shock = float(rng.exponential(0.3))
            label = 1
        elif r_type < 0.86: # 8% Condensation & Botrytis gray mold danger
            temp = float(rng.uniform(0.5, 3.0))
            hum = float(rng.uniform(97.0, 99.8)) # saturated condensation
            shock = float(rng.exponential(0.3))
            label = 1
        elif r_type < 0.93: # 7% Mechanical bruising shock (> 1.8g causes ethylene surge)
            temp = float(rng.uniform(1.5, 3.5))
            hum = float(rng.uniform(88.0, 94.0))
            shock = float(rng.uniform(1.9, 4.5))
            label = 1
        elif r_type < 0.97: # 4% Sub-zero frostbite (< -0.5°C cellular bursting)
            temp = float(rng.uniform(-4.0, -0.6))
            hum = float(rng.uniform(85.0, 92.0))
            shock = float(rng.exponential(0.25))
            label = 1
        else: # 3% High temperature decay (> 7.0°C, Q10 rapid respiration)
            temp = float(rng.uniform(7.5, 16.0))
            hum = float(rng.uniform(80.0, 90.0))
            shock = float(rng.exponential(0.3))
            label = 1

        records.append({
            "temperature": temp,
            "humidity": hum,
            "shock": shock,
            "speed": float(rng.uniform(20.0, 85.0)),
        })
        y_labels.append(label)

    return records, np.array(y_labels)


def train_and_evaluate():
    print("=" * 70)
    print("   FROSTLEDGER DUAL AI CARGO MODEL TRAINING PIPELINE")
    print("=" * 70)

    # 1. Train Vaccine & Biologics Model
    print("\n[1/2] Training Model 1: Vaccine & Biologics Cold-Chain Model...")
    vaccine_train_data, y_vax_train = generate_vaccine_training_data(1800, random_state=42)
    vaccine_val_data, y_vax_val = generate_vaccine_training_data(500, random_state=999)

    vax_model = VaccineColdChainModel(contamination=0.12, n_estimators=150, random_state=42)
    
    # Extract feature matrix
    X_vax_train = np.array([
        vax_model.extract_features(r, prev_reading=vaccine_train_data[i-1] if i > 0 else None)
        for i, r in enumerate(vaccine_train_data)
    ])
    vax_model.fit(X_vax_train)

    # Validate Vaccine Model
    X_vax_val = np.array([
        vax_model.extract_features(r, prev_reading=vaccine_val_data[i-1] if i > 0 else None)
        for i, r in enumerate(vaccine_val_data)
    ])
    vax_preds = []
    vax_scores = []
    for row in X_vax_val:
        is_anom, score, _ = vax_model.predict_anomaly(row)
        vax_preds.append(1 if is_anom else 0)
        vax_scores.append(score)

    vax_acc = accuracy_score(y_vax_val, vax_preds)
    vax_prec = precision_score(y_vax_val, vax_preds, zero_division=0)
    vax_rec = recall_score(y_vax_val, vax_preds, zero_division=0)
    vax_f1 = f1_score(y_vax_val, vax_preds, zero_division=0)

    print(f"  -> Vaccine Model Trained Successfully!")
    print(f"     Features: {vax_model.feature_names}")
    print(f"     Accuracy:  {vax_acc*100:.2f}%")
    print(f"     Precision: {vax_prec*100:.2f}%")
    print(f"     Recall:    {vax_rec*100:.2f}%")
    print(f"     F1-Score:  {vax_f1*100:.2f}%")

    vax_path = os.path.join(TRAINED_DIR, "vaccine_model.joblib")
    vax_model.save(vax_path)
    print(f"     Artifact saved: {vax_path}")

    # 2. Train Produce (Fruits / Vegetables) Model
    print("\n[2/2] Training Model 2: Fresh Produce (Fruits & Vegetables) Model...")
    produce_train_data, y_prod_train = generate_produce_training_data(1800, random_state=42)
    produce_val_data, y_prod_val = generate_produce_training_data(500, random_state=999)

    prod_model = ProduceColdChainModel(contamination=0.15, n_estimators=150, random_state=42)

    X_prod_train = np.array([
        prod_model.extract_features(r, prev_reading=produce_train_data[i-1] if i > 0 else None)
        for i, r in enumerate(produce_train_data)
    ])
    prod_model.fit(X_prod_train)

    # Validate Produce Model
    X_prod_val = np.array([
        prod_model.extract_features(r, prev_reading=produce_val_data[i-1] if i > 0 else None)
        for i, r in enumerate(produce_val_data)
    ])
    prod_preds = []
    prod_scores = []
    for row in X_prod_val:
        is_anom, score, _ = prod_model.predict_anomaly(row)
        prod_preds.append(1 if is_anom else 0)
        prod_scores.append(score)

    prod_acc = accuracy_score(y_prod_val, prod_preds)
    prod_prec = precision_score(y_prod_val, prod_preds, zero_division=0)
    prod_rec = recall_score(y_prod_val, prod_preds, zero_division=0)
    prod_f1 = f1_score(y_prod_val, prod_preds, zero_division=0)

    print(f"  -> Produce Model Trained Successfully!")
    print(f"     Features: {prod_model.feature_names}")
    print(f"     Accuracy:  {prod_acc*100:.2f}%")
    print(f"     Precision: {prod_prec*100:.2f}%")
    print(f"     Recall:    {prod_rec*100:.2f}%")
    print(f"     F1-Score:  {prod_f1*100:.2f}%")

    prod_path = os.path.join(TRAINED_DIR, "produce_model.joblib")
    prod_model.save(prod_path)
    print(f"     Artifact saved: {prod_path}")

    # Summary Report
    summary = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "models": {
            "vaccine_biologics": {
                "cargo_type": "vaccine",
                "target_corridor": "2.0°C to 8.0°C",
                "critical_rules": "Immediate failure at <= 0.0°C (WHO adjuvant coagulation rule)",
                "kinetics": "Arrhenius Ea = 83.14 kJ/mol",
                "accuracy": round(float(vax_acc), 4),
                "precision": round(float(vax_prec), 4),
                "recall": round(float(vax_rec), 4),
                "f1_score": round(float(vax_f1), 4),
                "features": vax_model.feature_names,
                "artifact_path": vax_path,
            },
            "fresh_produce": {
                "cargo_type": "produce",
                "target_corridor": "0.0°C to 4.0°C (Berries/Apples)",
                "critical_rules": "Transpiration moisture deficit (RH < 78%), Condensation dew point mold (RH > 95%), Bruising shock > 1.8g",
                "kinetics": "Respiration Q10 = 2.2",
                "accuracy": round(float(prod_acc), 4),
                "precision": round(float(prod_prec), 4),
                "recall": round(float(prod_rec), 4),
                "f1_score": round(float(prod_f1), 4),
                "features": prod_model.feature_names,
                "artifact_path": prod_path,
            },
        },
    }

    summary_path = os.path.join(TRAINED_DIR, "training_summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print("\n" + "=" * 70)
    print(f"   TRAINING COMPLETE: Saved summary to {summary_path}")
    print("=" * 70)
    return summary

if __name__ == "__main__":
    train_and_evaluate()
