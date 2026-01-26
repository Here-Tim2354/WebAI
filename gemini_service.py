from google import genai
from google.genai import types
from system_prompt import get_system_prompt
from PIL import Image
from utils import *

client=genai.Client(
    api_key="hajimi",
    http_options=types.HttpOptions(
        base_url="https://gemini.ystone.top",
        api_version="v1beta"
    )
)

user_config=types.GenerateContentConfig(
    thinking_config=types.ThinkingConfig(thinking_level="high"),
    system_instruction=get_system_prompt(),
    temperature=1.0
)

user_image=Image.open("image1.png")

while True:
    chat=client.chats.create(
        model="gemini-3-flash-preview",
        config=user_config
    )

    response=chat.send_message(get_compacted_contents("记住，我最喜欢的颜色是红色。",None))
    print(response.text)

    print("————"*20+"\n")

    response=chat.send_message(get_compacted_contents("我刚才说我最喜欢什么颜色？",None))
    print(response.text)
    
    print("————"*20+"\n")
    
    for message in chat.get_history():
        print(f'role - {message.role}',end=":")
        print(message.parts[-1].text)

    break
    

    
