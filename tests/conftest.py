# -*- coding: utf-8 -*-
from __future__ import annotations

import sqlite3

import pytest
from flask import g
from pioreactor.mureq import get

from pioreactorui import _make_dicts
from pioreactorui import create_app


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
            with app.open_resource("tests/example_data.sql") as f:
                db.executescript(f.read().decode("utf8"))

            db.commit()

        yield app


@pytest.fixture
def client(app):
    return app.test_client()
