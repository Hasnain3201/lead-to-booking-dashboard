from pathlib import Path

from streamlit.testing.v1 import AppTest

ROOT = Path(__file__).resolve().parents[1]


def test_demo_renders_and_empty_filters_are_safe():
    app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=30).run()
    assert not app.exception
    assert app.metric[0].value == "720"
    assert len(app.tabs) == 5
    app.sidebar.multiselect[0].set_value([]).run()
    assert not app.exception
    assert app.metric[0].value == "0"
    assert app.metric[1].value == "N/A"


def test_upload_mode_waits_for_complete_bundle():
    app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=30).run()
    app.sidebar.radio[0].set_value("Upload CSVs").run()
    assert not app.exception
    assert len(app.sidebar.get("file_uploader")) == 3
    assert any("Add inquiries" in warning.value for warning in app.warning)


def test_inquiry_detail_follows_filters():
    app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=30).run()
    assert not app.exception
    app.sidebar.multiselect[0].set_value(["referral"]).run()
    assert not app.exception
    choices = app.selectbox(key="detail_inquiry").options
    app.selectbox(key="detail_inquiry").set_value(choices[-1]).run()
    assert not app.exception
    assert app.selectbox(key="detail_inquiry").value == choices[-1]
    app.sidebar.multiselect[0].set_value([]).run()
    assert not app.exception
    assert len(app.selectbox) == 0
