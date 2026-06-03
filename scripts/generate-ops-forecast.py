#!/usr/bin/env python3
"""Generate PII-free ops forecast JSON from TEA Sales Google Sheets.

Read-only: fetches aggregate booking rows from the staging/copy Sales workbook and
writes local JSON artifacts for the private /ops/forecast dashboard. It never
writes to Google Sheets and intentionally excludes customer fields.
"""
from __future__ import annotations

import argparse
import calendar
import json
import math
import re
import statistics
import subprocess
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

DEFAULT_SHEET_ID = "1v3Oz5rqKeU6O4BDfkw8y_JSdi62-Q_Rma0ZQGN1lOlo"
DEFAULT_TABS = ["Sales 2023", "Sales 2024", "Sales 2025", "Sales 2026"]
CLOCKWORK_OPEN_DATE = date(2025, 4, 7)  # inferred from first Clockwork Odyssey booking in Sales data
ROOM_NAMES = ["Blackbeard's Revenge", "Lab Rats", "Clockwork Odyssey"]


@dataclass(frozen=True)
class Booking:
    source_tab: str
    booking_id: str
    transaction_date: date
    event_datetime: datetime
    adventure: str
    room: str
    participants: float
    gross: float

    @property
    def event_date(self) -> date:
        return self.event_datetime.date()


def system_today() -> date:
    return date.fromisoformat(subprocess.check_output(["date", "+%F"], text=True).strip())


def parse_dt(value: Any) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return datetime(1899, 12, 30) + timedelta(days=float(value))
    text = re.sub(r"\s+", " ", str(value).strip())
    for fmt in (
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M",
        "%m/%d/%Y %I:%M:%S %p",
        "%m/%d/%Y %I:%M %p",
        "%m/%d/%Y",
        "%m-%d-%Y %H:%M:%S",
        "%m-%d-%Y %H:%M",
        "%m-%d-%Y",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
    ):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            pass
    return None


def parse_num(value: Any, default: float = 0.0) -> float:
    if value in (None, ""):
        return default
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).replace("$", "").replace(",", "").strip()
    try:
        return float(text)
    except ValueError:
        return default


def percentile(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    values = sorted(values)
    pos = (len(values) - 1) * q
    lo = math.floor(pos)
    hi = math.ceil(pos)
    if lo == hi:
        return values[lo]
    return values[lo] * (hi - pos) + values[hi] * (pos - lo)


def infer_room(adventure: str) -> str | None:
    text = adventure.lower()
    if "blackbeard" in text:
        return "Blackbeard's Revenge"
    if "lab rats" in text or "labrat" in text:
        return "Lab Rats"
    if "clockwork" in text or "new game" in text:
        return "Clockwork Odyssey"
    return None


def is_test_booking_id(booking_id: str) -> bool:
    text = booking_id.strip().upper()
    return text.startswith(("TEST", "VALIDATION", "PABBLY-TEST", "PABBLY_TEST")) or "TEST" in text


def game_capacity_for(day: date) -> int:
    return 3 if day >= CLOCKWORK_OPEN_DATE else 2


def operating_windows_for(day: date) -> list[dict[str, Any]]:
    weekday = day.weekday()  # Mon=0
    if weekday in (1, 2):  # Tue/Wed
        return [{"key": "appt_5_close", "label": "5-11 PM appointment-only", "start_hour": 17, "end_hour": 23, "planned_staff": 1, "note": "Last booking 10 PM; at least 2 hours notice."}]
    if weekday == 3:  # Thu
        return [{"key": "thu_5_close", "label": "5-11 PM", "start_hour": 17, "end_hour": 23, "planned_staff": 1, "note": "Last booking 10 PM."}]
    if weekday == 4:  # Fri
        return [
            {"key": "fri_12_5", "label": "12-5 PM", "start_hour": 12, "end_hour": 17, "planned_staff": 1, "note": "Current known coverage: one staff onsite."},
            {"key": "fri_5_close", "label": "5-11 PM", "start_hour": 17, "end_hour": 23, "planned_staff": 2, "note": "Last booking 10 PM."},
        ]
    if weekday == 5:  # Sat
        return [
            {"key": "sat_12_5", "label": "12-5 PM", "start_hour": 12, "end_hour": 17, "planned_staff": 2, "note": "Coverage assumption pending staffing-plan feed."},
            {"key": "sat_5_close", "label": "5-11 PM", "start_hour": 17, "end_hour": 23, "planned_staff": 2, "note": "Last booking 10 PM; coverage assumption pending staffing-plan feed."},
        ]
    if weekday == 6:  # Sun
        return [
            {"key": "sun_12_5", "label": "12-5 PM", "start_hour": 12, "end_hour": 17, "planned_staff": 2, "note": "Coverage assumption pending staffing-plan feed."},
            {"key": "sun_5_close", "label": "5-10 PM", "start_hour": 17, "end_hour": 22, "planned_staff": 2, "note": "Last booking 9 PM; coverage assumption pending staffing-plan feed."},
        ]
    return [{"key": "closed_or_manual", "label": "Closed/manual review", "start_hour": 0, "end_hour": 24, "planned_staff": 0, "note": "Confirm appointment-only/closed-day policy."}]


def window_key_for(dt: datetime) -> str:
    for win in operating_windows_for(dt.date()):
        if win["start_hour"] <= dt.hour < win["end_hour"]:
            return str(win["key"])
    return "outside_configured_hours"


def read_sheet_values(sheet_id: str, tabs: list[str]) -> dict[str, list[list[Any]]]:
    token_path = Path.home() / ".hermes" / "google_token.json"
    creds = Credentials.from_authorized_user_file(str(token_path))
    service = build("sheets", "v4", credentials=creds, cache_discovery=False)
    ranges = [f"'{tab}'!A1:AF5000" for tab in tabs]
    response = service.spreadsheets().values().batchGet(
        spreadsheetId=sheet_id,
        ranges=ranges,
        valueRenderOption="UNFORMATTED_VALUE",
        dateTimeRenderOption="FORMATTED_STRING",
    ).execute()
    return {tab: vr.get("values", []) for tab, vr in zip(tabs, response.get("valueRanges", []))}


def load_bookings(sheet_id: str, tabs: list[str]) -> tuple[list[Booking], dict[str, Any]]:
    values_by_tab = read_sheet_values(sheet_id, tabs)
    bookings: list[Booking] = []
    skipped = Counter()
    row_counts: dict[str, int] = {}

    for tab, values in values_by_tab.items():
        if not values:
            skipped[f"{tab}:empty_tab"] += 1
            continue
        headers = [str(h).strip() for h in values[0]]
        header_index = {h: i for i, h in enumerate(headers) if h}
        row_counts[tab] = max(0, len(values) - 1)

        def get(row: list[Any], *names: str) -> Any:
            for name in names:
                index = header_index.get(name)
                if index is not None and index < len(row):
                    return row[index]
            return ""

        for row in values[1:]:
            booking_id = str(get(row, "Booking ID") or "").strip()
            if booking_id in ("", "0"):
                skipped[f"{tab}:blank_booking_id"] += 1
                continue
            if is_test_booking_id(booking_id):
                skipped[f"{tab}:test_booking_id"] += 1
                continue
            transaction_dt = parse_dt(get(row, "Transaction Date"))
            event_dt = parse_dt(get(row, "Booking Date"))
            if not transaction_dt or not event_dt:
                skipped[f"{tab}:unparseable_date"] += 1
                continue
            adventure = str(get(row, "Adventure") or "").strip()
            room = infer_room(adventure)
            if room is None:
                skipped[f"{tab}:non_room_or_unknown_adventure"] += 1
                continue
            participants = parse_num(get(row, "Total Participants"))
            gross = parse_num(get(row, "Gross Price"))
            bookings.append(Booking(
                source_tab=tab,
                booking_id=booking_id,
                transaction_date=transaction_dt.date(),
                event_datetime=event_dt,
                adventure=adventure,
                room=room,
                participants=participants,
                gross=gross,
            ))

    audit = {
        "tabs_requested": tabs,
        "source_row_counts": row_counts,
        "loaded_room_bookings": len(bookings),
        "skipped_counts": dict(skipped),
        "room_counts": dict(Counter(b.room for b in bookings)),
        "year_counts": dict(Counter(str(b.event_date.year) for b in bookings)),
    }
    return bookings, audit


def load_external_events(path: Path | None) -> list[dict[str, Any]]:
    if not path or not path.exists():
        return []
    return json.loads(path.read_text())


def event_notes_for(events: list[dict[str, Any]], target: date) -> list[str]:
    notes: list[str] = []
    for event in events:
        start = parse_dt(event.get("start_date"))
        end = parse_dt(event.get("end_date"))
        if start and end and start.date() <= target <= end.date():
            notes.append(str(event.get("event_name") or event.get("name") or "external event"))
    return notes


def day_window_metrics(bookings: list[Booking]) -> dict[tuple[date, str], dict[str, Any]]:
    metrics: dict[tuple[date, str], dict[str, Any]] = defaultdict(lambda: {"bookings": 0.0, "guests": 0.0, "gross": 0.0, "rooms": Counter()})
    for booking in bookings:
        key = (booking.event_date, window_key_for(booking.event_datetime))
        bucket = metrics[key]
        bucket["bookings"] += 1
        bucket["guests"] += booking.participants
        bucket["gross"] += booking.gross
        bucket["rooms"][booking.room] += 1
    return metrics


def historical_day_range(bookings: list[Booking], as_of: date) -> list[date]:
    """Return every historical calendar date in the analyzed data range.

    The forecast needs explicit zero-booking comparable days. Building history only
    from days that have bookings creates survivorship bias and overstates baseline
    demand, especially on appointment-only weekdays.
    """
    earliest = min((b.event_date for b in bookings if b.event_date.year >= 2023), default=date(2023, 1, 1))
    start = date(earliest.year, 1, 1)
    end = as_of - timedelta(days=1)
    days: list[date] = []
    current = start
    while current <= end:
        days.append(current)
        current += timedelta(days=1)
    return days


def build_forecast(bookings: list[Booking], audit: dict[str, Any], horizon_days: int, as_of: date, sheet_id: str, events: list[dict[str, Any]]) -> dict[str, Any]:
    metrics = day_window_metrics(bookings)
    current_or_future = {k: v for k, v in metrics.items() if k[0] >= as_of}

    # Historical same month+weekday+window. Include comparable days with zero
    # bookings, and do not inflate raw room starts from the 2-room era. Capacity
    # context is still recorded in metadata, but staffing pressure should reflect
    # actual observed room-start counts, not hypothetical capacity-scaled counts.
    hist_by_window: dict[tuple[int, int, str], list[dict[str, float]]] = defaultdict(list)
    hist_by_dow_window: dict[tuple[int, str], list[dict[str, float]]] = defaultdict(list)
    for day in historical_day_range(bookings, as_of):
        for win in operating_windows_for(day):
            win_key = str(win["key"])
            bucket = metrics.get((day, win_key), {"bookings": 0.0, "guests": 0.0, "gross": 0.0})
            observed = {
                "bookings": float(bucket["bookings"]),
                "guests": float(bucket["guests"]),
                "gross": float(bucket["gross"]),
                "raw_bookings": float(bucket["bookings"]),
            }
            hist_by_window[(day.month, day.weekday(), win_key)].append(observed)
            hist_by_dow_window[(day.weekday(), win_key)].append(observed)

    forecast_rows: list[dict[str, Any]] = []
    for offset in range(horizon_days):
        target = as_of + timedelta(days=offset)
        windows = []
        day_on_books = {"bookings": 0.0, "guests": 0.0, "gross": 0.0}
        day_forecast = {"bookings": 0.0, "guests": 0.0, "gross": 0.0}
        max_staff_needed = 0
        max_planned_staff = 0
        max_blocking_risk = 0.0
        blocked_gross_total = 0.0

        for win in operating_windows_for(target):
            win_key = win["key"]
            samples = hist_by_window.get((target.month, target.weekday(), win_key)) or hist_by_dow_window.get((target.weekday(), win_key)) or []
            hist_bookings = [s["bookings"] for s in samples]
            hist_guests = [s["guests"] for s in samples]
            hist_gross = [s["gross"] for s in samples]
            on = current_or_future.get((target, win_key), {"bookings": 0.0, "guests": 0.0, "gross": 0.0, "rooms": Counter()})

            base_bookings = statistics.mean(hist_bookings) if hist_bookings else 0.0
            base_guests = statistics.mean(hist_guests) if hist_guests else 0.0
            base_gross = statistics.mean(hist_gross) if hist_gross else 0.0
            forecast_bookings = max(base_bookings, float(on["bookings"]))
            forecast_guests = max(base_guests, float(on["guests"]))
            gross_per_booking = (base_gross / base_bookings) if base_bookings else 100.0
            forecast_gross = max(base_gross, float(on["gross"]), forecast_bookings * gross_per_booking)

            # Crude room-pressure proxy until real start-time concurrency is modeled:
            # 0-2 starts in a daypart -> 1 staff, 3-4 -> 2 staff, 5+ -> 3 staff.
            # Closed/manual days are special: if nothing is on books, historical
            # manual/team-building activity is context, not a staffing gap. If an
            # off-hours booking is on books, assume coverage was manually arranged.
            on_bookings = float(on["bookings"])
            if win_key == "closed_or_manual" and on_bookings == 0:
                staff_needed = 0
            else:
                staff_needed = min(3, max(0, math.ceil(forecast_bookings / 2)))
            if win_key == "closed_or_manual" and on_bookings > 0:
                planned_staff = staff_needed
            else:
                planned_staff = int(win["planned_staff"])
            blocking_risk = 0.0
            if planned_staff > 0 and staff_needed > planned_staff:
                blocking_risk = (staff_needed - planned_staff) / staff_needed
            blocked_gross = forecast_gross * blocking_risk

            day_on_books["bookings"] += float(on["bookings"])
            day_on_books["guests"] += float(on["guests"])
            day_on_books["gross"] += float(on["gross"])
            day_forecast["bookings"] += forecast_bookings
            day_forecast["guests"] += forecast_guests
            day_forecast["gross"] += forecast_gross
            max_staff_needed = max(max_staff_needed, staff_needed)
            max_planned_staff = max(max_planned_staff, planned_staff)
            max_blocking_risk = max(max_blocking_risk, blocking_risk)
            blocked_gross_total += blocked_gross

            windows.append({
                "key": win_key,
                "label": win["label"],
                "planned_staff": planned_staff,
                "staffing_note": win["note"],
                "samples": len(samples),
                "on_books_room_starts": round(float(on["bookings"]), 1),
                "on_books_guests": round(float(on["guests"]), 1),
                "on_books_rooms": dict(on.get("rooms", Counter())),
                "baseline_room_starts": round(base_bookings, 1),
                "forecast_room_starts_low": round(percentile(hist_bookings, 0.25), 1),
                "forecast_room_starts_base": round(forecast_bookings, 1),
                "forecast_room_starts_high": round(max(percentile(hist_bookings, 0.75), forecast_bookings), 1),
                "forecast_guests_base": round(forecast_guests, 1),
                "staff_needed_estimate": staff_needed,
                "coverage_gap": max(0, staff_needed - planned_staff),
                "blocking_risk": round(blocking_risk, 3),
                "blocked_gross_potential": round(blocked_gross, 2),
            })

        notes = event_notes_for(events, target)
        samples_total = sum(w["samples"] for w in windows)
        forecast_rows.append({
            "date": target.isoformat(),
            "weekday": calendar.day_name[target.weekday()],
            "days_until": offset,
            "samples": samples_total,
            "on_books_bookings": round(day_on_books["bookings"], 1),
            "on_books_guests": round(day_on_books["guests"], 1),
            "baseline_bookings": round(sum(w["baseline_room_starts"] for w in windows), 1),
            "baseline_guests": round(sum(w["forecast_guests_base"] for w in windows), 1),
            "forecast_bookings_low": round(sum(w["forecast_room_starts_low"] for w in windows), 1),
            "forecast_bookings_base": round(day_forecast["bookings"], 1),
            "forecast_bookings_high": round(sum(w["forecast_room_starts_high"] for w in windows), 1),
            "forecast_guests_low": round(sum(w["forecast_guests_base"] for w in windows), 1),
            "forecast_guests_base": round(day_forecast["guests"], 1),
            "forecast_guests_high": round(sum(w["forecast_guests_base"] for w in windows), 1),
            "forecast_gross_base": round(day_forecast["gross"], 2),
            "staffing": "; ".join(f"{w['label']}: {w['planned_staff']} staff planned" for w in windows),
            "external_events": ", ".join(notes),
            "expected_rooms": round(max((w["forecast_room_starts_base"] for w in windows), default=0), 1),
            "concurrent_staff_needed": max_staff_needed,
            "staff_availability": max_planned_staff,
            "blocking_risk": round(max_blocking_risk, 3),
            "blocked_gross_potential": round(blocked_gross_total, 2),
            "windows": windows,
        })

    metadata = {
        "generated_date": as_of.isoformat(),
        "source_workbook_id": sheet_id,
        "source_tabs": DEFAULT_TABS,
        "loaded_rows": audit["loaded_room_bookings"],
        "model_version": "1.3-manual-day-and-test-filter",
        "privacy_note": "All data is PII-free and aggregate. No customer identifiers are included.",
        "external_events": len(events),
        "capacity_model": {
            "current_game_capacity": 3,
            "pre_clockwork_capacity": 2,
            "clockwork_open_date_inferred": CLOCKWORK_OPEN_DATE.isoformat(),
            "normalization": "Staffing pressure uses observed historical room starts, including zero-booking comparable days. Pre-Clockwork capacity is documented for context but no longer inflates room-start baselines.",
        },
        "model_limits": [
            "Staff coverage values are planning assumptions until a live staffing-plan feed exists.",
            "Closed/manual-day historical bookings are treated as manually covered context, not automatic coverage gaps when nothing is on books.",
            "Booking IDs that look like validation/test/Pabbly test rows are excluded from aggregate forecasts.",
            "Window-level room pressure is based on aggregate room starts by daypart, not exact minute-by-minute game concurrency yet.",
            "Same-day rows should treat historical baseline as context; actual on-books pressure is the reliable overlap signal.",
            "Birthday/team-building rows are mapped to their associated room when the Adventure label contains a known room name.",
        ],
        "audit": audit,
    }
    return {"metadata": metadata, "forecast": forecast_rows}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sheet-id", default=DEFAULT_SHEET_ID)
    parser.add_argument("--horizon-days", type=int, default=21)
    parser.add_argument("--as-of", default=None)
    parser.add_argument("--events", type=Path, default=Path("/home/tfintelligence/TFI/projects/escape-adventures-analytics/event-intel/events-latest.json"))
    parser.add_argument("--output", type=Path, default=Path("src/data/forecast-latest.json"))
    parser.add_argument("--event-output", type=Path, default=Path("src/data/event-intel-latest.json"))
    args = parser.parse_args()

    as_of = date.fromisoformat(args.as_of) if args.as_of else system_today()
    events = load_external_events(args.events)
    bookings, audit = load_bookings(args.sheet_id, DEFAULT_TABS)
    payload = build_forecast(bookings, audit, args.horizon_days, as_of, args.sheet_id, events)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    args.event_output.parent.mkdir(parents=True, exist_ok=True)
    args.event_output.write_text(json.dumps(events, indent=2, ensure_ascii=False) + "\n")

    print(json.dumps({
        "output": str(args.output),
        "event_output": str(args.event_output),
        "loaded_rows": payload["metadata"]["loaded_rows"],
        "forecast_days": len(payload["forecast"]),
        "audit": payload["metadata"]["audit"],
    }, indent=2))


if __name__ == "__main__":
    main()
