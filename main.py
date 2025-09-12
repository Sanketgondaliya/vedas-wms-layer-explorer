from fastapi import FastAPI, Query, Response
from fastapi.middleware.cors import CORSMiddleware
import httpx
from urllib.parse import urlencode

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to your specific domain
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

        # Return as raw XML instead of JSON
        return Response(content=response.text, media_type="application/xml")

    except Exception as e:
        return {"error": str(e)}

@app.get("/proxy/getfeatureinfo")
async def proxy_get_featureinfo(
    url: str = Query(..., description="WMS base URL (without params)"),
    bbox: str = Query(..., description="Bounding box coordinates"),
    width: int = Query(..., description="Map width in pixels"),
    height: int = Query(..., description="Map height in pixels"),
    x: int = Query(..., description="X coordinate of click"),
    y: int = Query(..., description="Y coordinate of click"),
    layers: str = Query(..., description="Comma-separated layer names"),
    crs: str = Query("EPSG:3857", description="Coordinate reference system")
):
    # Build the GetFeatureInfo request URL
    params = {
        'SERVICE': 'WMS',
        'VERSION': '1.3.0',
        'REQUEST': 'GetFeatureInfo',
        'QUERY_LAYERS': layers,
        'LAYERS': layers,
        'INFO_FORMAT': 'application/json',
        'FEATURE_COUNT': 10,
        'I': x,
        'J': y,
        'WIDTH': width,
        'HEIGHT': height,
        'CRS': crs,
        'BBOX': bbox
    }
    
    featureinfo_url = f"{url}?{urlencode(params)}"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(featureinfo_url)
        
        # Return the response as JSON
        return Response(
            content=response.content,
            media_type=response.headers.get("content-type", "application/json")
        )

    except Exception as e:
        return {"error": str(e)}
