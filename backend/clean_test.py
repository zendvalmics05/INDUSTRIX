from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

print("APP ID:", id(app))

@app.middleware("http")
async def debug(request, call_next):
    print("🔥 middleware hit", request.method, "APP ID:", id(app))
    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/ping")
def ping():
    return {"msg": "pong"}