from google import genai
from google.genai import types
from system_prompt import get_system_prompt
from PIL import Image
from utils import *
import pathlib

# 初始化客户端，通过http_options修改base_url
client = genai.Client(
    api_key="hajimi",
    http_options=types.HttpOptions(
        base_url="https://gemini.ystone.top", api_version="v1beta"
    ),
)


grouding_tool = types.Tool(google_search=types.GoogleSearch())
url_context = types.Tool(url_context=types.UrlContext())


# 自定义config，包括思考强度，系统提示词以及温度等参数
user_config = types.GenerateContentConfig(
    thinking_config=types.ThinkingConfig(thinking_level="high", include_thoughts=True),
    system_instruction=get_system_prompt(),
    temperature=1.0,
    media_resolution=types.MediaResolution.MEDIA_RESOLUTION_MEDIUM,
    tools=[grouding_tool, url_context],
)

user_image = Image.open("../image1.png")

user_file_pdf = pathlib.Path("../DeepSeek_OCR_paper.pdf")


while True:
    chat = client.chats.create(model="gemini-3-flash-preview", config=user_config)

    response = chat.send_message(
        get_compacted_contents(
            "使用googlesearch和urlcontext阅读该网址，给出基本信息： https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app "
        )
    )

    for part in response.candidates[0].content.parts:
        if not part.text:
            continue
        if part.thought:
            print("思考过程：\n" + part.text)
        else:
            print("回答：\n" + part.text)

    print("Token共计：" + str(response.usage_metadata.total_token_count))
    print("缓存Token：" + str(response.usage_metadata.cached_content_token_count))
    print(
        "工具调用的Token：" + str(response.usage_metadata.tool_use_prompt_token_count)
    )
    print("是否执行网络搜索：" + str(is_google_search(response)))
    print("是否进行URL检索：" + str(is_url_context(response)))
    print("url内容：" + str(response.candidates[0].url_context_metadata))
    print("返回的JSON：\n")
    print_response_json(response)

    break
