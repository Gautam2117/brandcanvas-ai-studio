from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response
from rembg import remove

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for hackathon demo; later you can restrict to your Vercel domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/remove-bg")
async def remove_bg(file: UploadFile = File(...)):
    data = await file.read()
    out_png_bytes = remove(data)  # PNG bytes with alpha
    return Response(content=out_png_bytes, media_type="image/png")
