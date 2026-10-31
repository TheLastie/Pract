"""Integration tests for the mushroom REST API using an in-memory SQLite database."""

import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy import create_engine

from backend.app.database import Base, get_db
from backend.app.main import app
from backend.app.models import Mushroom


TEST_ENGINE = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(bind=TEST_ENGINE, autoflush=False, expire_on_commit=False)


def override_get_db():
    with TestSession() as session:
        yield session


class MushroomApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(TEST_ENGINE)
        with TestSession.begin() as session:
            session.execute(delete(Mushroom))

    def setUp(self):
        with TestSession.begin() as session:
            session.execute(delete(Mushroom))
        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()

    def test_crud_lifecycle_and_status_codes(self):
        self.assertEqual(self.client.get("/api/mushrooms").status_code, 200)
        payload = {
            "name": "Лисичка",
            "latin": "Cantharellus cibarius",
            "family": "Лисичковые",
            "season": "июнь — ноябрь",
            "category": "edible",
            "description": "Наблюдение в смешанном лесу.",
        }
        created = self.client.post("/api/mushrooms", json=payload)
        self.assertEqual(created.status_code, 201)
        mushroom = created.json()
        self.assertEqual(mushroom["name"], payload["name"])
        self.assertEqual(mushroom["category"], "edible")
        self.assertTrue(mushroom["created_at"])

        mushroom_id = mushroom["id"]
        self.assertEqual(self.client.get(f"/api/mushrooms/{mushroom_id}").json(), mushroom)
        self.assertEqual(len(self.client.get("/api/mushrooms").json()), 1)

        updated = self.client.patch(
            f"/api/mushrooms/{mushroom_id}", json={"description": "Наблюдение у опушки соснового леса."}
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["description"], "Наблюдение у опушки соснового леса.")
        self.assertEqual(updated.json()["name"], payload["name"])

        self.assertEqual(self.client.delete(f"/api/mushrooms/{mushroom_id}").status_code, 204)
        self.assertEqual(self.client.get(f"/api/mushrooms/{mushroom_id}").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/mushrooms/{mushroom_id}").status_code, 404)

    def test_validation_and_openapi_documentation(self):
        invalid = self.client.post("/api/mushrooms", json={"name": "A", "category": "unsafe"})
        self.assertEqual(invalid.status_code, 422)
        created = self.client.post("/api/mushrooms", json={
            "name": "Гриб", "family": "Болетовые", "season": "осень",
            "category": "unknown", "description": "Наблюдение в лесу без определения.",
        })
        self.assertEqual(created.status_code, 201)
        mushroom_id = created.json()["id"]
        self.assertEqual(self.client.patch(f"/api/mushrooms/{mushroom_id}", json={}).status_code, 400)

        schema = self.client.get("/openapi.json")
        self.assertEqual(schema.status_code, 200)
        paths = schema.json()["paths"]
        self.assertEqual(set(paths["/api/mushrooms"]), {"get", "post"})
        self.assertEqual(set(paths["/api/mushrooms/{mushroom_id}"]), {"get", "patch", "delete"})
        self.assertEqual(self.client.get("/docs").status_code, 200)

    def test_documentation_uses_local_assets(self):
        pages = (("/docs", "/docs-assets/swagger-ui-bundle.js"), ("/redoc", "/docs-assets/redoc.standalone.js"))
        for path, asset in pages:
            page = self.client.get(path)
            self.assertEqual(page.status_code, 200)
            self.assertIn(asset, page.text)
            self.assertNotIn("cdn.jsdelivr.net", page.text)
        for asset in ("swagger-ui-bundle.js", "swagger-ui.css", "redoc.standalone.js"):
            self.assertEqual(self.client.get(f"/docs-assets/{asset}").status_code, 200)

    def test_image_paths_must_reference_project_assets(self):
        payload = {
            "name": "Гриб",
            "family": "Болетовые",
            "season": "осень",
            "category": "unknown",
            "description": "Наблюдение в лесу без точного определения.",
            "illustration": "https://example.org/tracker.png",
        }
        self.assertEqual(self.client.post("/api/mushrooms", json=payload).status_code, 422)

    def test_uploaded_photo_is_stored_in_database_and_served(self):
        mushroom = self.client.post("/api/mushrooms", json={
            "name": "Гриб с фото", "family": "Болетовые", "season": "осень",
            "category": "unknown", "description": "Наблюдение рядом с лесной тропой.",
        }).json()
        photo = (Path(__file__).resolve().parents[2] / "assets/images/chanterelle-photo.jpg").read_bytes()
        uploaded = self.client.put(f"/api/mushrooms/{mushroom['id']}/photo", content=photo)
        self.assertEqual(uploaded.status_code, 200)
        self.assertEqual(uploaded.json()["photo"], f"/api/mushrooms/{mushroom['id']}/photo")
        second = self.client.put(f"/api/mushrooms/{mushroom['id']}/photo?slot=2", content=photo)
        self.assertEqual(second.status_code, 200, second.text)
        self.assertEqual(second.json()["photo2"], f"/api/mushrooms/{mushroom['id']}/photo?slot=2")
        response = self.client.get(uploaded.json()["photo"])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "image/jpeg")
        self.assertEqual(response.content, photo)
        second_response = self.client.get(second.json()["photo2"])
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(second_response.content, photo)
        invalid = self.client.put(f"/api/mushrooms/{mushroom['id']}/photo", content=b"not an image")
        self.assertEqual(invalid.status_code, 415)


if __name__ == "__main__":
    unittest.main()
