from adapters.gemini_adapter import GeminiAdapter
from schemas import CustomGeminiClientSettings, GeminiGenerationConfig

class GeminiService:
    def __init__(self, adapter: GeminiAdapter):
        self.adapter = adapter

    def gemini_generate_content(
        self,
        model: str,
        user_input: str,
        settings: CustomGeminiClientSettings,
        config: GeminiGenerationConfig,
    ):
        if not settings.gemini_api_key:
            raise ValueError("gemini_api_key is required")
        if not settings.gemini_base_url:
            raise ValueError("gemini_base_url is required")

        sdk_config = config.to_sdk_config() if config is not None else None
        response = self.adapter.generate(
            model=model,
            contents=user_input,
            config=sdk_config
        )

        return response.model_dump(mode="json")