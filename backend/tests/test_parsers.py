from pija.etl.parsers import parse_br_date, parse_br_datetime, parse_br_id


def test_parse_br_datetime_with_hour():
    assert parse_br_datetime("24/2/2025, 18:00") == "2025-02-24T18:00:00"
    assert parse_br_datetime("1/1/2015, 00:51") == "2015-01-01T00:51:00"
    assert parse_br_datetime("26/2/2025, 13:25") == "2025-02-26T13:25:00"


def test_parse_br_datetime_empty_returns_none():
    assert parse_br_datetime("") is None
    assert parse_br_datetime(None) is None
    assert parse_br_datetime("   ") is None


def test_parse_br_datetime_invalid_returns_none():
    assert parse_br_datetime("foo") is None
    assert parse_br_datetime("32/13/2025, 99:99") is None


def test_parse_br_date_without_hour():
    assert parse_br_date("25/8/2015") == "2015-08-25"
    assert parse_br_date("1/1/2020") == "2020-01-01"


def test_parse_br_date_empty_returns_none():
    assert parse_br_date("") is None
    assert parse_br_date(None) is None


def test_parse_br_id_removes_thousand_separator():
    assert parse_br_id("1.458.992") == "1458992"
    assert parse_br_id("17.774") == "17774"
    assert parse_br_id("21.532.437") == "21532437"


def test_parse_br_id_handles_no_separator():
    assert parse_br_id("12345") == "12345"


def test_parse_br_id_empty_returns_none():
    assert parse_br_id("") is None
    assert parse_br_id(None) is None
    assert parse_br_id("   ") is None