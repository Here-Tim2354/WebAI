from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

app=FastAPI()

class MyData(BaseModel):
    prompt:str

@app.post("/chat")
async def chat_endpoint(data:MyData):
    print(f"JAVA发送的信息为：{data.prompt}")
    reply=f"Python确认收到"

    return {"result":reply}


if __name__ == "__main__":
    uvicorn.run(app,host="127.0.0.1",port=5000)

