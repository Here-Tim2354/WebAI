from google import genai
from google.genai import types

class GeminiAdapter:
    def __init__(self, api_key: str, base_url: str):
        self._client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(
                base_url=base_url,
                api_version="v1beta"
            )
        )

    def generate(self, model: str, contents: str, config=None):
        return self._client.models.generate_content(
            model=model,
            contents=contents,
            config=config
        )