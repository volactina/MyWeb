import os
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from backend import create_app


@pytest.fixture()
def tmp_data_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    data_file = tmp_path / "testdatabase.csv"
    monkeypatch.setenv("MYWEB_DATA_FILE", str(data_file))
    monkeypatch.setenv("MYWEB_TEST_MODE", "1")
    return data_file


@pytest.fixture()
def client(tmp_data_file: Path):
    app = create_app()
    app.config.update(TESTING=True)
    return app.test_client()


def test_create_and_list_root_only(client):
    res = client.post(
        "/api/items",
        json={
            "title": "Root A",
            "detail": "hello",
            "urgency_level": "0",
            "project_status": "0",
        },
    )
    assert res.status_code == 201
    item = res.get_json()
    assert item["id"] == "1"
    assert item["title"] == "Root A"
    assert item["created_at"]
    assert item["updated_at"]

    res2 = client.get("/api/items")
    assert res2.status_code == 200
    items = res2.get_json()
    assert isinstance(items, list)
    assert len(items) == 1
    assert items[0]["title"] == "Root A"
    assert items[0]["parent_ids"] == ""


def test_prereq_blocking_rule(client):
    # prereq project (not completed)
    r1 = client.post("/api/items", json={"title": "Prereq", "detail": "", "project_status": "0"})
    assert r1.status_code == 201
    prereq_id = r1.get_json()["id"]

    # target project depends on prereq -> should become blocked (4)
    r2 = client.post(
        "/api/items",
        json={"title": "Target", "detail": "", "prerequisite_ids": prereq_id, "project_status": "0"},
    )
    assert r2.status_code == 201
    target_id = r2.get_json()["id"]

    all_items = client.get("/api/items?all=1").get_json()
    by_id = {str(x["id"]): x for x in all_items}
    assert by_id[target_id]["project_status"] == "4"
    assert prereq_id in (by_id[target_id]["blocked_by_ids"] or "")

    # mark prereq completed -> target should become pending (0) and unblocked
    r3 = client.patch(f"/api/items/{prereq_id}/status", json={"project_status": "2"})
    assert r3.status_code == 200

    all_items2 = client.get("/api/items?all=1").get_json()
    by_id2 = {str(x["id"]): x for x in all_items2}
    assert by_id2[target_id]["project_status"] == "0"
    assert (by_id2[target_id]["blocked_by_ids"] or "") == ""


def test_move_parent_api(client):
    rp = client.post("/api/items", json={"title": "Parent", "detail": ""})
    rc = client.post("/api/items", json={"title": "Child", "detail": ""})
    assert rp.status_code == 201 and rc.status_code == 201
    parent_id = rp.get_json()["id"]
    child_id = rc.get_json()["id"]

    mv = client.patch(f"/api/items/{child_id}/parent", json={"parent_id": parent_id})
    assert mv.status_code == 200

    all_items = client.get("/api/items?all=1").get_json()
    by_id = {str(x["id"]): x for x in all_items}
    assert by_id[child_id]["parent_ids"] == parent_id

    mv2 = client.patch(f"/api/items/{child_id}/parent", json={"parent_id": ""})
    assert mv2.status_code == 200
    all_items2 = client.get("/api/items?all=1").get_json()
    by_id2 = {str(x["id"]): x for x in all_items2}
    assert by_id2[child_id]["parent_ids"] == ""


def test_delete_fails_when_has_children(client):
    rp = client.post("/api/items", json={"title": "Parent", "detail": ""})
    rc = client.post("/api/items", json={"title": "Child", "detail": ""})
    parent_id = rp.get_json()["id"]
    child_id = rc.get_json()["id"]

    mv = client.patch(f"/api/items/{child_id}/parent", json={"parent_id": parent_id})
    assert mv.status_code == 200

    d = client.delete(f"/api/items/{parent_id}")
    assert d.status_code == 400
    data = d.get_json()
    assert "delete failed" in (data.get("error") or "")


def test_add_prereq_endpoint_appends_and_dedups(client):
    r1 = client.post("/api/items", json={"title": "A", "detail": ""})
    r2 = client.post("/api/items", json={"title": "B", "detail": ""})
    a_id = r1.get_json()["id"]
    b_id = r2.get_json()["id"]

    p1 = client.patch(f"/api/items/{b_id}/prerequisites", json={"add": a_id})
    assert p1.status_code == 200
    p2 = client.patch(f"/api/items/{b_id}/prerequisites", json={"add": a_id})
    assert p2.status_code == 200

    all_items = client.get("/api/items?all=1").get_json()
    by_id = {str(x["id"]): x for x in all_items}
    assert by_id[b_id]["prerequisite_ids"] == a_id


def test_status_3_keeps_planned(client):
    r = client.post("/api/items", json={"title": "Planned", "detail": "", "project_status": "3"})
    assert r.status_code == 201
    item = r.get_json()
    assert item["project_status"] == "3"
    assert item.get("planned_execute_date") == datetime.now().strftime("%Y-%m-%d")


def test_default_project_status_is_planned_when_omitted(client):
    r = client.post("/api/items", json={"title": "DefaultStatus", "detail": ""})
    assert r.status_code == 201
    assert r.get_json().get("project_status") == "3"
    assert r.get_json().get("planned_execute_date") == datetime.now().strftime("%Y-%m-%d")


def test_status_patch_to_planned_sets_today_when_no_schedule(client):
    r = client.post("/api/items", json={"title": "Later", "detail": "", "project_status": "0"})
    item_id = r.get_json()["id"]
    assert not (r.get_json().get("planned_execute_date") or "").strip()
    p = client.patch(f"/api/items/{item_id}/status", json={"project_status": "3"})
    assert p.status_code == 200
    assert p.get_json().get("project_status") == "3"
    assert p.get_json().get("planned_execute_date") == datetime.now().strftime("%Y-%m-%d")


def test_status_3_keeps_explicit_planned_execute_date(client):
    r = client.post(
        "/api/items",
        json={
            "title": "DatedPlan",
            "detail": "",
            "project_status": "3",
            "planned_execute_date": "2027-06-01",
        },
    )
    assert r.status_code == 201
    assert r.get_json().get("planned_execute_date") == "2027-06-01"


def test_planned_time_roundtrip(client):
    r = client.post(
        "/api/items",
        json={"title": "WithTime", "detail": "", "planned_time": "09:30"},
    )
    assert r.status_code == 201
    assert r.get_json().get("planned_time") == "09:30"
    item_id = r.get_json()["id"]
    u = client.put(
        f"/api/items/{item_id}",
        json={"title": "WithTime", "detail": "", "planned_time": "14:00"},
    )
    assert u.status_code == 200
    assert u.get_json().get("planned_time") == "14:00"


def test_in_progress_limit_enforced(client, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("MYWEB_MAX_IN_PROGRESS", "2")
    for i in range(2):
        r = client.post("/api/items", json={"title": f"In{i}", "detail": "", "project_status": "1"})
        assert r.status_code == 201
    r3 = client.post("/api/items", json={"title": "OverCap", "detail": "", "project_status": "1"})
    assert r3.status_code == 400
    assert "上限" in (r3.get_json().get("error") or "")


def test_schedule_keep_status_preserves_status(client):
    r = client.post("/api/items", json={"title": "KeepSt", "detail": "", "project_status": "0"})
    item_id = r.get_json()["id"]
    future = (datetime.now().date() + timedelta(days=5)).isoformat()
    p = client.patch(
        f"/api/items/{item_id}/schedule",
        json={"planned_execute_date": future, "keep_status": True},
    )
    assert p.status_code == 200
    assert p.get_json().get("project_status") == "0"


def test_schedule_patch_in_progress_to_non_today_becomes_planned(client):
    future = (datetime.now().date() + timedelta(days=15)).isoformat()
    r = client.post("/api/items", json={"title": "InProg", "detail": "", "project_status": "1"})
    item_id = r.get_json()["id"]
    p = client.patch(
        f"/api/items/{item_id}/schedule",
        json={"planned_execute_date": future},
    )
    assert p.status_code == 200
    assert p.get_json().get("planned_execute_date") == future
    assert p.get_json().get("project_status") == "3"


def test_schedule_patch_in_progress_keep_status_preserves_in_progress(client):
    future = (datetime.now().date() + timedelta(days=20)).isoformat()
    r = client.post("/api/items", json={"title": "Roll", "detail": "", "project_status": "1"})
    item_id = r.get_json()["id"]
    p = client.patch(
        f"/api/items/{item_id}/schedule",
        json={"planned_execute_date": future, "keep_status": True},
    )
    assert p.status_code == 200
    assert p.get_json().get("project_status") == "1"


def test_schedule_patch_in_progress_same_day_stays_in_progress(client):
    r = client.post("/api/items", json={"title": "TodayIp", "detail": "", "project_status": "1"})
    item_id = r.get_json()["id"]
    today = r.get_json().get("planned_execute_date")
    assert today
    p = client.patch(
        f"/api/items/{item_id}/schedule",
        json={"planned_execute_date": today},
    )
    assert p.status_code == 200
    assert p.get_json().get("project_status") == "1"


def test_schedule_patch_incomplete_past_date_rejected(client):
    past = (datetime.now().date() - timedelta(days=2)).isoformat()
    r = client.post("/api/items", json={"title": "NoPast", "detail": "", "project_status": "0"})
    item_id = r.get_json()["id"]
    p = client.patch(f"/api/items/{item_id}/schedule", json={"planned_execute_date": past})
    assert p.status_code == 400
    assert "过去" in (p.get_json().get("error") or "")


def test_completed_item_may_patch_schedule_to_past(client):
    past = (datetime.now().date() - timedelta(days=10)).isoformat()
    r = client.post("/api/items", json={"title": "Done", "detail": "", "project_status": "2"})
    item_id = r.get_json()["id"]
    p = client.patch(f"/api/items/{item_id}/schedule", json={"planned_execute_date": past})
    assert p.status_code == 200
    assert p.get_json().get("planned_execute_date") == past


def test_put_incomplete_past_planned_execute_date_rejected(client):
    r = client.post("/api/items", json={"title": "Put", "detail": "", "project_status": "0"})
    item_id = r.get_json()["id"]
    past = (datetime.now().date() - timedelta(days=1)).isoformat()
    u = client.put(
        f"/api/items/{item_id}",
        json={"title": "Put", "detail": "", "planned_execute_date": past},
    )
    assert u.status_code == 400
    assert "过去" in (u.get_json().get("error") or "")


def test_create_incomplete_with_past_schedule_rejected(client):
    past = (datetime.now().date() - timedelta(days=3)).isoformat()
    r = client.post(
        "/api/items",
        json={"title": "BadCreate", "detail": "", "project_status": "3", "planned_execute_date": past},
    )
    assert r.status_code == 400
    assert "过去" in (r.get_json().get("error") or "")


def test_economic_benefit_expectation_defaults_to_4(client):
    r = client.post("/api/items", json={"title": "NoEconField", "detail": ""})
    assert r.status_code == 201
    assert r.get_json().get("economic_benefit_expectation") == "4"


def test_economic_benefit_expectation_affects_priority_sort(client):
    client.post(
        "/api/items",
        json={"title": "LowEcon", "detail": "", "economic_benefit_expectation": "5"},
    )
    client.post(
        "/api/items",
        json={"title": "HighEcon", "detail": "", "economic_benefit_expectation": "0"},
    )
    items = client.get("/api/items?all=1").get_json()
    titles = [x["title"] for x in items]
    assert titles.index("HighEcon") < titles.index("LowEcon")


def test_project_category_defaults_to_2(client):
    r = client.post("/api/items", json={"title": "NoCatField", "detail": ""})
    assert r.status_code == 201
    assert r.get_json().get("project_category") == "2"


def test_project_category_auto_sets_to_manage_when_has_children(client):
    rp = client.post("/api/items", json={"title": "Parent", "detail": "", "project_category": "2"})
    rc = client.post("/api/items", json={"title": "Child", "detail": ""})
    parent_id = rp.get_json()["id"]
    child_id = rc.get_json()["id"]
    mv = client.patch(f"/api/items/{child_id}/parent", json={"parent_id": parent_id})
    assert mv.status_code == 200

    all_items = client.get("/api/items?all=1").get_json()
    by_id = {str(x["id"]): x for x in all_items}
    assert by_id[parent_id]["child_ids"].strip() != ""
    assert by_id[parent_id]["project_category"] == "1"


def test_project_category_affects_priority_sort(client):
    client.post("/api/items", json={"title": "Manage", "detail": "", "project_category": "1"})
    client.post("/api/items", json={"title": "Exec", "detail": "", "project_category": "2"})
    items = client.get("/api/items?all=1").get_json()
    titles = [x["title"] for x in items]
    assert titles.index("Exec") < titles.index("Manage")


def test_schedule_patch_sets_planned_execute_date_and_planned_status(client):
    r = client.post("/api/items", json={"title": "Sched", "detail": ""})
    item_id = r.get_json()["id"]
    assert r.get_json().get("project_status") == "3"
    future = (datetime.now().date() + timedelta(days=8)).isoformat()
    p = client.patch(f"/api/items/{item_id}/schedule", json={"planned_execute_date": future})
    assert p.status_code == 200
    assert p.get_json().get("planned_execute_date") == future
    assert p.get_json().get("project_status") == "3"

    all_items = client.get("/api/items?all=1").get_json()
    by_id = {str(x["id"]): x for x in all_items}
    assert by_id[item_id]["planned_execute_date"] == future
    assert by_id[item_id]["project_status"] == "3"

