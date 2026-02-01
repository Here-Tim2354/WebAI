from fastapi import FastAPI, Depends, HTTPException
from service.gemini_service import GeminiService
from schemas import JavaChatRequest
from env_client_config import NativeGeminiClientSettings, get_settings
import uvicorn

app = FastAPI()


@app.post("/chat")
async def chat_endpoint(
    java_request: JavaChatRequest,
    env_settings: NativeGeminiClientSettings = Depends(get_settings),
):
    custom_dict = (
        java_request.custom_settings.model_dump(exclude_none=True)
        if java_request.custom_settings
        else {}
    )
    final_settings = env_settings.model_copy(update=custom_dict)

    try:
        return GeminiService.gemini_generate_content(
            model=java_request.model,
            user_input=java_request.user_input,
            settings=final_settings,
            config=java_request.config,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=5000)
