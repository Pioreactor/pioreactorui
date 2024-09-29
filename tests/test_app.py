# -*- coding: utf-8 -*-
from __future__ import annotations

import sqlite3

import pytest
from flask import g
from pioreactor.mureq import get

from pioreactorui.app import _make_dicts
from pioreactorui.app import create_app


@pytest.fixture()
def app():
    app = create_app()
    app.config.update(
        {
            "TESTING": True,
        }
    )

    with app.app_context():
        r = get(
            "https://raw.githubusercontent.com/Pioreactor/CustoPiZer/refs/heads/pioreactor/workspace/scripts/files/sql/create_tables.sql"
        )
        table_statements = r.body.decode()

        db = getattr(g, "_app_database", None)
        if db is None:
            db = g._app_database = sqlite3.connect(":memory:")
            db.row_factory = _make_dicts
            db.executescript(table_statements)  # Set up schema
            with app.open_resource("tests/test_data.sql") as f:
                db.executescript(f.read().decode("utf8"))

            db.commit()

        yield app


@pytest.fixture
def client(app):
    return app.test_client()


def test_latest_experiment_endpoint(client):
    response = client.get("/api/experiments/latest")

    assert response.status_code == 200
    data = response.get_json()
    assert data["experiment"] == "exp3"
    assert data["description"] == "Third experiment"
    assert data["delta_hours"] > 0


def test_assignment_count(client):
    response = client.get("/api/experiments/assignment_count")

    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 3
    assert data[0]["worker_count"] == 2
    assert data[0]["experiment"] == "exp1"


def test_get_workers(client):
    response = client.get("/api/workers")
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 4  # We have 4 workers in the sample data
    units = [worker["pioreactor_unit"] for worker in data]
    assert "unit1" in units
    assert "unit2" in units
    assert "unit3" in units
    assert "unit4" in units


def test_get_worker(client):
    response = client.get("/api/workers/unit1")
    assert response.status_code == 200
    data = response.get_json()
    assert data["pioreactor_unit"] == "unit1"
    assert data["is_active"] == 1
    assert data["added_at"] == "2023-10-01T10:00:00Z"


def test_get_experiment_assignment_for_worker(client):
    response = client.get("/api/workers/unit1/experiment")
    assert response.status_code == 200
    data = response.get_json()
    assert data["experiment"] == "exp1"


def test_get_workers_for_experiment(client):
    response = client.get("/api/experiments/exp1/workers")
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 2  # exp1 has two workers assigned
    units = [worker["pioreactor_unit"] for worker in data]
    assert "unit1" in units
    assert "unit2" in units


def test_add_worker_to_experiment(client):
    # Add unit4 to exp1
    response = client.put("/api/experiments/exp1/workers", json={"pioreactor_unit": "unit4"})
    assert response.status_code == 200

    # Verify unit4 is now assigned to exp1
    response = client.get("/api/experiments/exp1/workers")
    data = response.get_json()
    units = [worker["pioreactor_unit"] for worker in data]
    assert "unit4" in units


def test_remove_worker_from_experiment(client):
    # Remove unit2 from exp1
    response = client.delete("/api/experiments/exp1/workers/unit2")
    assert response.status_code == 200

    # Verify unit2 is no longer assigned to exp1
    response = client.get("/api/experiments/exp1/workers")
    data = response.get_json()
    units = [worker["pioreactor_unit"] for worker in data]
    assert "unit2" not in units


def test_remove_worker_from_experiment_it_doesnt_belong_to(client):
    # Try to remove unit2 from an experiment it's not assigned to.
    response = client.delete("/api/experiments/exp99/workers/unit2")
    assert response.status_code == 404


def test_get_assignment_count(client):
    response = client.get("/api/experiments/assignment_count")
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 3  # We have 3 experiments
    exp1 = next((item for item in data if item["experiment"] == "exp1"), None)
    exp2 = next((item for item in data if item["experiment"] == "exp2"), None)
    exp3 = next((item for item in data if item["experiment"] == "exp3"), None)
    assert exp1["worker_count"] == 2
    assert exp2["worker_count"] == 1
    assert exp3["worker_count"] == 1


def test_change_worker_status(client):
    # Deactivate unit3
    response = client.put("/api/workers/unit3/is_active", json={"is_active": 0})
    assert response.status_code == 200

    # Verify the status change
    response = client.get("/api/workers/unit3")
    data = response.get_json()
    assert data["is_active"] == 0


def test_get_unit_labels(client):
    response = client.get("/api/experiments/exp1/unit_labels")
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 2  # exp1 has labels for unit1 and unit2
    assert data["unit1"] == "Reactor 1"
    assert data["unit2"] == "Reactor 2"


def test_upsert_unit_labels(client):
    # Update label for unit1 in exp1
    response = client.patch(
        "/api/experiments/exp1/unit_labels",
        json={"unit": "unit1", "label": "Updated Reactor 1"},
    )
    assert response.status_code == 201

    # Verify the label update
    response = client.get("/api/experiments/exp1/unit_labels")
    data = response.get_json()
    assert data["unit1"] == "Updated Reactor 1"


@pytest.mark.xfail(reason="need to mock datetime")
def test_get_logs_for_unit_and_experiment(client):
    response = client.get("/api/workers/unit1/experiments/exp1/logs")
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 1  # Only one log entry for unit1 in exp1
    log = data[0]
    assert log["message"] == "Started mixing"
    assert log["source"] == "mixer"
    assert log["level"] == "INFO"
    assert log["task"] == "mixing_task"


@pytest.mark.xfail(reason="need to mock datetime")
def test_get_growth_rates(client):
    response = client.get("/api/experiments/exp1/time_series/growth_rates")
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 2  # Two growth rates for exp1
    rates = [item["rate"] for item in data]
    assert 0.02 in rates
    assert 0.025 in rates


def test_create_experiment(client):
    # Create a new experiment
    response = client.post(
        "/api/experiments",
        json={
            "experiment": "exp4",
            "created_at": "2023-10-04T12:00:00Z",
            "description": "Fourth experiment",
            "media_used": "Special media",
            "organism_used": "Algae",
        },
    )
    assert response.status_code == 201  # Created

    # Verify the experiment exists
    response = client.get("/api/experiments/exp4")
    assert response.status_code == 200
    data = response.get_json()
    assert data["experiment"] == "exp4"
    assert data["description"] == "Fourth experiment"


def test_create_duplicate_experiment(client):
    # Try to create an experiment with a duplicate name 'exp1'
    response = client.post(
        "/api/experiments",
        json={
            "experiment": "exp1",
            "created_at": "2023-10-05T12:00:00Z",
            "description": "Duplicate experiment",
        },
    )
    assert response.status_code == 409


def test_update_experiment(client):
    # Update an existing experiment
    response = client.patch(
        "/api/experiments/exp2",
        json={
            "description": "Updated second experiment",
        },
    )
    assert response.status_code == 200  # OK

    # Verify the updates
    response = client.get("/api/experiments/exp2")
    data = response.get_json()
    assert data["description"] == "Updated second experiment"


def test_update_nonexistent_experiment(client):
    # Try to update an experiment that doesn't exist
    response = client.patch(
        "/api/experiments/nonexistent_exp",
        json={
            "description": "This should fail",
        },
    )
    assert response.status_code == 404  # Not Found


def test_create_experiment_missing_fields(client):
    # Try to create an experiment without required fields
    response = client.post(
        "/api/experiments",
        json={
            # Missing 'experiment' name
            "created_at": "2023-10-06T12:00:00Z",
            "description": "No name experiment",
        },
    )
    assert response.status_code == 400  # Bad Request
