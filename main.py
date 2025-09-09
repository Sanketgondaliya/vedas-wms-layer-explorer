from fastapi import FastAPI, Query, Response
from fastapi.middleware.cors import CORSMiddleware
import httpx

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # change "*" to your GitHub Pages URL for security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/proxy/getcapabilities")
async def proxy_get_capabilities(
    url: str = Query(..., description="WMS base URL (without params)")
):
    capabilities_url = f"{url}?service=WMS&request=GetCapabilities&version=1.3.0"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(capabilities_url)

        # return as raw XML instead of JSON
        return Response(content=response.text, media_type="application/xml")

    except Exception as e:
        return {"error": str(e)}
