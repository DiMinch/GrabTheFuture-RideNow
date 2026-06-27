import httpx
from app.core.config import settings
from app.services.geocoder import NominatimGeocoder

geocoder = NominatimGeocoder()

async def execute_tool(tool_name: str, args: dict, context: dict) -> dict:
    """
    Executes a function call requested by the Gemini Live Agent.
    Returns:
        A dict containing the execution results.
    """
    print(f"[AI-Gateway] Executing tool: {tool_name} with args: {args}")
    
    if tool_name == "geocode_address":
        address = args.get("address")
        if not address:
            return {"error": "No address provided"}
        
        # Geocode using Nominatim with context coordinates and language if available
        latitude = context.get("latitude")
        longitude = context.get("longitude")
        lang = context.get("lang")
        result = geocoder.geocode(address, latitude, longitude, lang)
        if result:
            print(f"[AI-Gateway] Geocode success: {result['display_name']} -> ({result['lat']}, {result['lng']})")
            return result
        else:
            print(f"[AI-Gateway] Geocode failed for address: {address}")
            return {"error": f"Could not find coordinates for: {address}"}

    if tool_name == "create_booking":
        # Call Backend Server REST API to register the ride booking
        pickup_lat = args.get("pickup_lat")
        pickup_lng = args.get("pickup_lng")
        dropoff_lat = args.get("dropoff_lat")
        dropoff_lng = args.get("dropoff_lng")
        dropoff_address = args.get("dropoff_address", "Destination Address")

        payload = {
            "pickupLocation": {"latitude": pickup_lat, "longitude": pickup_lng},
            "dropoffLocation": {"latitude": dropoff_lat, "longitude": dropoff_lng},
            "pickupAddress": "Current Location", # Backfilled or parsed
            "dropoffAddress": dropoff_address,
            "accessibilityMode": True
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{settings.BACKEND_SERVER_URL}/bookings",
                    json=payload,
                    timeout=10
                )
                if response.status_code == 201:
                    booking_data = response.json()
                    print(f"[AI-Gateway] Booking created successfully: {booking_data['id']}")
                    return {
                        "bookingId": booking_data["id"],
                        "status": booking_data["status"],
                        "driverEta": 5 # Mock ETA in minutes
                    }
                else:
                    return {"error": f"Backend returned status code {response.status_code}"}
        except Exception as e:
            print(f"[AI-Gateway] Error calling backend for booking: {e}")
            return {"error": "Connection to booking service failed"}

    return {"error": f"Unknown tool: {tool_name}"}
