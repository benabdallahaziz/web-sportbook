import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Disable Eureka & RabbitMQ & Security for unit tests
from app.config import settings
settings.EUREKA_ENABLED = False
settings.RABBITMQ_ENABLED = False
settings.SECURITY_ENABLED = False
settings.DATABASE_URL = "sqlite:///:memory:"

from app.database import Base, get_db
from app.main import app

test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


ADMIN = {"X-User-Id": "99", "X-User-Roles": "ADMIN"}
GERANT_A = {"X-User-Id": "10", "X-User-Roles": "GERANT"}
GERANT_B = {"X-User-Id": "20", "X-User-Roles": "GERANT"}
SPORTIF = {"X-User-Id": "30", "X-User-Roles": "SPORTIF"}


@pytest.fixture(autouse=True)
def fake_identity(monkeypatch):
    """Pas d'appel réseau vers identity-user-service pendant les tests."""
    import app.routers.venues as venues_router

    async def always_exists(owner_id):
        return owner_id != 404404

    monkeypatch.setattr(venues_router, "verify_owner_exists", always_exists)


@pytest.fixture
def client():
    # Par défaut les requêtes sont faites en ADMIN (en-têtes transmis par la Gateway)
    with TestClient(app, headers=ADMIN) as c:
        yield c


def test_root_and_health(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["service"] == "venue-management-service"

    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "UP"


def test_actuator_endpoints(client):
    # 1. /actuator index
    r = client.get("/actuator")
    assert r.status_code == 200
    assert "_links" in r.json()

    # 2. /actuator/health
    r = client.get("/actuator/health")
    assert r.status_code == 200
    assert r.json()["status"] == "UP"
    assert "components" in r.json()

    # 3. /actuator/info
    r = client.get("/actuator/info")
    assert r.status_code == 200
    assert r.json()["app"]["name"] == "venue-management-service"
    assert "architecture" in r.json()

    # 4. /actuator/metrics
    r = client.get("/actuator/metrics")
    assert r.status_code == 200
    assert "process.uptime" in r.json()["names"]

    # 5. /actuator/metrics/process.uptime
    r = client.get("/actuator/metrics/process.uptime")
    assert r.status_code == 200
    assert r.json()["name"] == "process.uptime"


def test_create_and_get_venue(client):
    # 1. Create venue
    payload = {
        "name": "Arena Sport Center",
        "city": "Tunis",
        "address": "Les Berges du Lac, Tunis",
        "phone": "+216 71 000 111",
        "owner_id": 1,
        "opening_hours": [
            {"day": "Lundi", "opening_time": "08:00:00", "closing_time": "23:00:00"},
            {"day": "Mardi", "opening_time": "08:00:00", "closing_time": "23:00:00"}
        ]
    }
    r = client.post("/api/venues", json=payload)
    assert r.status_code == 201
    data = r.json()
    venue_id = data["id"]
    assert data["name"] == "Arena Sport Center"
    assert data["address"] == "Les Berges du Lac, Tunis"

    # 2. Get All venues
    r = client.get("/api/venues")
    assert r.status_code == 200
    assert len(r.json()) == 1

    # Filter by city
    r = client.get("/api/venues?city=Tunis")
    assert r.status_code == 200
    assert len(r.json()) == 1

    # Filter by search
    r = client.get("/api/venues?search=Arena")
    assert r.status_code == 200
    assert len(r.json()) == 1

    # Filter by owner_id
    r = client.get("/api/venues?owner_id=1")
    assert r.status_code == 200
    assert len(r.json()) == 1

    r = client.get("/api/venues?city=Sousse")
    assert r.status_code == 200
    assert len(r.json()) == 0

    # 3. Get Venue by ID with details
    r = client.get(f"/api/venues/{venue_id}")
    assert r.status_code == 200
    detail = r.json()
    assert detail["name"] == "Arena Sport Center"
    assert len(detail["opening_hours"]) == 2

    # 4. Summary endpoint
    r = client.get(f"/api/venues/{venue_id}/summary")
    assert r.status_code == 200
    assert r.json()["name"] == "Arena Sport Center"


def test_update_venue(client):
    r = client.post("/api/venues", json={"name": "Old Name", "city": "Sousse", "address": "Sousse"})
    venue_id = r.json()["id"]

    r = client.put(f"/api/venues/{venue_id}", json={
        "name": "New Name",
        "address": "Sousse Port",
        "phone": "+216 73 111 222",
        "opening_hours": [
            {"day": "Samedi", "opening_time": "09:00:00", "closing_time": "20:00:00"}
        ]
    })
    assert r.status_code == 200
    updated = r.json()
    assert updated["name"] == "New Name"
    assert updated["address"] == "Sousse Port"
    assert updated["phone"] == "+216 73 111 222"
    assert len(updated["opening_hours"]) == 1


def test_field_crud_and_cascade_delete(client):
    # 1. Create venue
    v_res = client.post("/api/venues", json={"name": "Tennis & Padel Club", "city": "Ariana", "address": "Ariana"})
    venue_id = v_res.json()["id"]

    # 2. Create Field
    f_res = client.post("/api/fields", json={
        "name": "Court Central",
        "sport": "Tennis",
        "price": 60.0,
        "venue_id": venue_id
    })
    assert f_res.status_code == 201
    field_id = f_res.json()["id"]
    assert f_res.json()["name"] == "Court Central"

    # Create second field
    client.post("/api/fields", json={
        "name": "Padel Court 1",
        "sport": "Padel",
        "price": 100.0,
        "venue_id": venue_id
    })

    # 3. Get all fields & test filters
    r = client.get("/api/fields")
    assert r.status_code == 200
    assert len(r.json()) == 2

    # Filter by sport
    r = client.get("/api/fields?sport=Tennis")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["sport"] == "Tennis"

    # Filter by price
    r = client.get("/api/fields?max_price=70")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["name"] == "Court Central"

    # Filter by min price
    r = client.get("/api/fields?min_price=80")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["name"] == "Padel Court 1"

    # 4. Get Field by ID & Summary
    r = client.get(f"/api/fields/{field_id}")
    assert r.status_code == 200
    assert r.json()["name"] == "Court Central"

    r = client.get(f"/api/fields/{field_id}/summary")
    assert r.status_code == 200
    assert r.json()["price_per_hour"] == 60.0
    assert r.json()["venue_name"] == "Tennis & Padel Club"

    # 5. Update Field
    r = client.put(f"/api/fields/{field_id}", json={"price": 75.0, "name": "Court Central (éclairé)"})
    assert r.status_code == 200
    assert r.json()["price"] == 75.0
    assert r.json()["name"] == "Court Central (éclairé)"

    # 6. Get Venue fields via /api/venues/{id}/fields
    r = client.get(f"/api/venues/{venue_id}/fields")
    assert r.status_code == 200
    assert len(r.json()) == 2

    # 7. Delete venue and verify cascade delete
    r = client.delete(f"/api/venues/{venue_id}")
    assert r.status_code == 204

    # Verify venue is gone
    r = client.get(f"/api/venues/{venue_id}")
    assert r.status_code == 404

    # Verify fields are cascaded deleted
    r = client.get(f"/api/fields/{field_id}")
    assert r.status_code == 404


def test_dedicated_opening_hours(client):
    v_res = client.post("/api/venues", json={"name": "Gym Club", "city": "Tunis", "address": "Menzah"})
    venue_id = v_res.json()["id"]

    # Add opening hours via dedicated endpoint
    oh_res = client.post(f"/api/venues/{venue_id}/opening-hours", json={
        "day": "Dimanche",
        "opening_time": "09:00:00",
        "closing_time": "18:00:00"
    })
    assert oh_res.status_code == 201
    assert oh_res.json()["day"] == "Dimanche"

    # Get opening hours
    r = client.get(f"/api/venues/{venue_id}/opening-hours")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_not_found_and_validation_errors(client):
    # Non-existent venue
    assert client.get("/api/venues/9999").status_code == 404
    assert client.put("/api/venues/9999", json={"name": "X"}).status_code == 404
    assert client.delete("/api/venues/9999").status_code == 404

    # Non-existent field
    assert client.get("/api/fields/9999").status_code == 404
    assert client.put("/api/fields/9999", json={"name": "X"}).status_code == 404
    assert client.delete("/api/fields/9999").status_code == 404

    # Create field with non-existent venue_id
    r = client.post("/api/fields", json={
        "name": "Invalid Field",
        "sport": "Tennis",
        "price": 50.0,
        "venue_id": 99999
    })
    assert r.status_code == 400


# ─────────────────────── Nouveau modèle, propriété et maintenance ───────────────────────

def test_rich_venue_and_field_model(client):
    r = client.post("/api/venues", json={
        "name": "Padel Club Lac", "city": "Tunis", "description": "4 courts couverts",
        "image_url": "https://example.com/padel.jpg", "amenities": ["Parking", "douches", "parking", "wifi"],
        "opening_hours": [{"day": "lundi", "opening_time": "8:00", "closing_time": "22:00"}],
    })
    assert r.status_code == 201, r.text
    v = r.json()
    assert v["city"] == "Tunis" and v["status"] == "ACTIVE"
    assert v["amenities"] == "parking,douches,wifi"
    assert v["amenities_list"] == ["parking", "douches", "wifi"]
    assert v["opening_hours"][0]["day"] == "Lundi"

    f = client.post("/api/fields", json={"name": "Court 1", "sport": "Padel", "price": 60, "surface": "Gazon synthétique",
                                         "is_indoor": True, "venue_id": v["id"]}).json()
    assert f["is_indoor"] is True and f["status"] == "AVAILABLE" and f["venue_name"] == "Padel Club Lac"

    cat = client.get("/api/venues").json()[0]
    assert cat["sports"] == ["Padel"] and cat["min_price"] == 60 and cat["has_indoor"] is True
    assert len(client.get("/api/venues?sport=Padel&indoor=true&max_price=70&city=tunis").json()) == 1
    assert client.get("/api/venues?sport=Tennis").json() == []
    assert client.get("/api/venues?max_price=50").json() == []


def test_validation_errors_on_new_fields(client):
    assert client.post("/api/venues", json={"name": "Sans ville"}).status_code == 422
    assert client.post("/api/venues", json={"name": "X", "city": "Tunis", "status": "FERME"}).status_code == 422
    r = client.post("/api/venues", json={"name": "X", "city": "Tunis",
                                         "opening_hours": [{"day": "Lundi", "opening_time": "22:00", "closing_time": "08:00"}]})
    assert r.status_code == 422
    r = client.post("/api/venues", json={"name": "X", "city": "Tunis",
                                         "opening_hours": [{"day": "Funday", "opening_time": "08:00", "closing_time": "18:00"}]})
    assert r.status_code == 422


def test_ownership_rules(client):
    # Un gérant crée un complexe : il en devient propriétaire, même s'il envoie un autre owner_id
    r = client.post("/api/venues", json={"name": "Club A", "city": "Sousse", "owner_id": 999}, headers=GERANT_A)
    assert r.status_code == 201
    venue_id = r.json()["id"]
    assert r.json()["owner_id"] == 10

    # Le gérant B ne peut ni modifier, ni supprimer, ni ajouter de terrain
    assert client.put(f"/api/venues/{venue_id}", json={"name": "Pirate"}, headers=GERANT_B).status_code == 403
    assert client.delete(f"/api/venues/{venue_id}", headers=GERANT_B).status_code == 403
    r = client.post("/api/fields", json={"name": "T", "sport": "Football", "price": 50, "venue_id": venue_id}, headers=GERANT_B)
    assert r.status_code == 403
    assert r.json()["detail"] == "Vous n'êtes pas le propriétaire de ce complexe."

    # Le propriétaire peut ; un gérant ne peut pas céder son complexe
    f = client.post("/api/fields", json={"name": "T", "sport": "Football", "price": 50, "venue_id": venue_id}, headers=GERANT_A)
    assert f.status_code == 201
    field_id = f.json()["id"]
    assert client.put(f"/api/venues/{venue_id}", json={"owner_id": 20}, headers=GERANT_A).status_code == 403
    assert client.put(f"/api/fields/{field_id}", json={"price": 55}, headers=GERANT_B).status_code == 403
    assert client.put(f"/api/fields/{field_id}", json={"price": 55}, headers=GERANT_A).json()["price"] == 55

    # Sportif et anonyme : pas d'écriture
    assert client.post("/api/venues", json={"name": "X", "city": "Tunis"}, headers=SPORTIF).status_code == 403
    assert client.post("/api/venues", json={"name": "X", "city": "Tunis"},
                       headers={"X-User-Id": "", "X-User-Roles": ""}).status_code == 401

    # my-venues : chacun ne voit que les siens, l'admin voit tout
    client.post("/api/venues", json={"name": "Club B", "city": "Sfax"}, headers=GERANT_B)
    assert [v["name"] for v in client.get("/api/venues/my-venues", headers=GERANT_A).json()] == ["Club A"]
    assert [v["name"] for v in client.get("/api/venues/my-venues", headers=GERANT_B).json()] == ["Club B"]
    assert len(client.get("/api/venues/my-venues", headers=ADMIN).json()) == 2
    assert client.get("/api/venues/my-venues", headers=SPORTIF).status_code == 403

    # L'admin peut tout faire, y compris réattribuer
    assert client.put(f"/api/venues/{venue_id}", json={"owner_id": 20}, headers=ADMIN).json()["owner_id"] == 20
    assert client.put(f"/api/venues/{venue_id}", json={"owner_id": 404404}, headers=ADMIN).status_code == 400


def test_toggle_maintenance_and_inactive_venues(client):
    v = client.post("/api/venues", json={"name": "Club M", "city": "Monastir"}, headers=GERANT_A).json()
    f = client.post("/api/fields", json={"name": "Court", "sport": "Tennis", "price": 40, "venue_id": v["id"]},
                    headers=GERANT_A).json()
    assert client.patch(f"/api/fields/{f['id']}/toggle-maintenance", headers=GERANT_B).status_code == 403
    r = client.patch(f"/api/fields/{f['id']}/toggle-maintenance", headers=GERANT_A)
    assert r.status_code == 200 and r.json()["status"] == "MAINTENANCE"
    # Un terrain en maintenance ne compte plus dans le prix "à partir de"
    assert client.get("/api/venues").json()[0]["min_price"] is None
    assert client.get(f"/api/fields/{f['id']}/summary").json()["bookable"] is False
    assert client.patch(f"/api/fields/{f['id']}/toggle-maintenance", headers=GERANT_A).json()["status"] == "AVAILABLE"

    # Complexe INACTIVE : masqué du catalogue public, visible pour son gérant
    client.put(f"/api/venues/{v['id']}", json={"status": "INACTIVE"}, headers=GERANT_A)
    assert client.get("/api/venues").json() == []
    assert len(client.get("/api/venues?include_inactive=true").json()) == 1
    assert client.get("/api/venues/my-venues", headers=GERANT_A).json()[0]["status"] == "INACTIVE"


def test_replace_week_opening_hours(client):
    v = client.post("/api/venues", json={"name": "Club H", "city": "Tunis"}, headers=GERANT_A).json()
    week = [{"day": d, "opening_time": "08:00", "closing_time": "22:00"} for d in ["Samedi", "Lundi", "Mardi"]]
    r = client.put(f"/api/venues/{v['id']}/opening-hours", json=week, headers=GERANT_A)
    assert r.status_code == 200
    assert [h["day"] for h in r.json()] == ["Lundi", "Mardi", "Samedi"]
    assert client.put(f"/api/venues/{v['id']}/opening-hours", json=week, headers=GERANT_B).status_code == 403
    dup = [{"day": "Lundi", "opening_time": "08:00", "closing_time": "12:00"}] * 2
    assert client.put(f"/api/venues/{v['id']}/opening-hours", json=dup, headers=GERANT_A).status_code == 400
    oh_id = r.json()[0]["id"]
    assert client.delete(f"/api/venues/{v['id']}/opening-hours/{oh_id}", headers=GERANT_A).status_code == 204
    assert len(client.get(f"/api/venues/{v['id']}/opening-hours").json()) == 2
