from typing import List, Optional, Dict, Any, Type, Union
from pydantic import BaseModel, Field
from google.genai import types
from enum import Enum


class GeminiThinkingLevel(str, Enum):
    MINIMAL = "minimal"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class GeminiThinkingConfig(BaseModel):
    include_thoughts: Optional[bool] = Field(default=True)
    thinking_budget: Optional[int] = Field(default=None)
    thinking_level: Optional[GeminiThinkingLevel] = Field(
        default=GeminiThinkingLevel.HIGH
    )


class GeminiImageConfig(BaseModel):
    pass


class GeminiSpeechConfig(BaseModel):
    pass


# Tools的写法是简化过的,接受JAVA传递的布尔值。不支持自定义调整工具参数
class GeminiTools(BaseModel):
    enable_google_search: Optional[bool] = Field(default=False)
    enable_url_context: Optional[bool] = Field(default=False)


class GeminiGenerationConfig(BaseModel):
    # 基础生成参数
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    top_p: Optional[float] = Field(default=None)
    top_k: Optional[int] = Field(default=None)
    seed: Optional[int] = Field(default=None)
    max_output_tokens: Optional[int] = Field(default=None)
    candidate_count: Optional[int] = Field(default=1)
    stop_sequences: Optional[List[str]] = Field(default=None)

    # 结构化输出与格式(JSON输出待完善)
    response_mime_type: Optional[str] = Field(default="text/plain")
    response_schema: Optional[Union[Dict[str, Any], Type[BaseModel], Type[Enum]]] = Field(default=None)

    # 上下文控制
    presence_penalty: Optional[float] = Field(default=None)
    frequency_penalty: Optional[float] = Field(default=None)

    # (过时)Gemini 2.0 特性
    include_thoughts: Optional[bool] = Field(default=False)
    thought_budget_token_count: Optional[int] = Field(default=None)

    # 系统提示词,思考和工具.其中工具部分是对接JAVA传递的布尔值
    thinking_config: Optional[GeminiThinkingConfig] = Field(default=None)
    system_instruction: Optional[str] = None
    tools: Optional[GeminiTools] = Field(default=None)

    # 多模态相关
    speech_config: Optional[GeminiSpeechConfig] = Field(default=None)
    image_config: Optional[GeminiImageConfig] = Field(default=None)
    media_resolution: Optional[Dict[str, Any]] = Field(default=None)

    # 思考置信度
    response_logprobs: Optional[bool] = Field(default=False)
    logprobs: Optional[int] = Field(default=None)

    def to_sdk_tools(self) -> Optional[List[types.Tool]]:
        if not self.tools:
            return None
        else:
            sdk_tools = []
            for key, value in self.tools.model_dump().items():
                if value:
                    if key == "enable_google_search":
                        sdk_tools.append(types.Tool(google_search=types.GoogleSearch()))
                    if key == "enable_url_context":
                        sdk_tools.append(types.Tool(url_context=types.UrlContext()))
            return sdk_tools if sdk_tools else None

    def to_sdk_config(self) -> types.GenerateContentConfig:
        """转换为 SDK GenerateContentConfig 对象"""

        # 处理 thinking_config 转换
        sdk_thinking_config = None
        if self.thinking_config:
            sdk_thinking_config = types.ThinkingConfig(
                **self.thinking_config.model_dump(
                    exclude_none=True,
                    mode="json",
                    exclude={"thinking_level"},
                )
            )

        # 处理工具转换

        sdk_tools = self.to_sdk_tools()

        return types.GenerateContentConfig(
            # 基础生成参数
            temperature=self.temperature,
            top_p=self.top_p,
            top_k=self.top_k,
            seed=self.seed,
            max_output_tokens=self.max_output_tokens,
            candidate_count=self.candidate_count,
            stop_sequences=self.stop_sequences,
            # 结构化输出与格式
            response_mime_type=self.response_mime_type,
            response_schema=self.response_schema,
            # 上下文控制
            presence_penalty=self.presence_penalty,
            frequency_penalty=self.frequency_penalty,
            # 系统提示词
            system_instruction=self.system_instruction,
            # 工具集成
            tools=sdk_tools,
            # 思考配置
            thinking_config=sdk_thinking_config,
            # 多模态相关
            media_resolution=self.media_resolution,
            # 思考置信度
            response_logprobs=self.response_logprobs,
            logprobs=self.logprobs,
        )


class CustomGeminiClientSettings(BaseModel):
    gemini_api_key : Optional[str] = None
    gemini_base_url : Optional[str] = None


class JavaChatRequest(BaseModel):
    """
    用于接受 JAVA 层发送的 JSON 请求体并验证
    其中custom_settings是可选项，用于覆盖环境默认值
    """

    model: str
    user_input: str
    custom_settings: Optional[CustomGeminiClientSettings] = None
    config: Optional[GeminiGenerationConfig] = None
