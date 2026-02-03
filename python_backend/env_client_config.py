from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from pathlib import Path


class NativeGeminiClientSettings(BaseSettings):
    gemini_api_key: str
    gemini_base_url: str

    # 以下为Pydantic库的字段
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings():
    return NativeGeminiClientSettings()
