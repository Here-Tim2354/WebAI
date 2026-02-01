from google import genai
from google.genai import types
from schemas import CustomGeminiClientSettings, GeminiGenerationConfig


class GeminiService:
    @staticmethod
    def gemini_generate_content(
        model: str,
        user_input: str,
        settings: CustomGeminiClientSettings,
        config: GeminiGenerationConfig,
    ):
        if not settings.gemini_api_key:
            raise ValueError("gemini_api_key is required")
        if not settings.gemini_base_url:
            raise ValueError("gemini_base_url is required")

        client = genai.Client(
            api_key=settings.gemini_api_key,
            http_options=types.HttpOptions(
                base_url=settings.gemini_base_url,
                api_version="v1beta"
            )
        )

        response = client.models.generate_content(
            model=model,
            contents=user_input,
            config=config.to_sdk_config() if config is not None else None
        )

        return response.model_dump(mode="json", exclude_none=True)
