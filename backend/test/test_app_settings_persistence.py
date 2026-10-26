from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.routes.settings import AppSettingsSchema, PUBLIC_FIELDS, load_app_settings, save_app_settings
from app.db.base import Base
from app.models.store_settings import StoreSettings  # noqa: F401 - registers the settings table
from app.services.chat_service import _build_system_prompt


def test_app_settings_and_stylist_prompt_survive_new_database_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    expected = AppSettingsSchema(
        storeName="VASTRAX",
        stylistSystemPrompt="Answer warmly and offer general fashion advice.",
        activeOffers="Verified offer only",
    )

    with Session() as db:
        save_app_settings(db, expected)

    with Session() as db:
        loaded = load_app_settings(db)
        assert loaded.stylistSystemPrompt == expected.stylistSystemPrompt
        assert loaded.activeOffers == expected.activeOffers
        assert loaded.storeName == expected.storeName
        assert "stylistSystemPrompt" not in loaded.model_dump(include=PUBLIC_FIELDS)
        assert expected.stylistSystemPrompt in _build_system_prompt(profile={}, db=db)

        loaded.stylistSystemPrompt = "Use short, friendly replies."
        save_app_settings(db, loaded)

    with Session() as db:
        assert load_app_settings(db).stylistSystemPrompt == "Use short, friendly replies."

    engine.dispose()
