import requests
from typing import Optional, Tuple, Dict, Any

class NominatimGeocoder:
    """
    Free Geocoding Service using OpenStreetMap Nominatim API.
    Does not require an API key, but requires a unique User-Agent.
    """
    def __init__(self, user_agent: str = "RideNow-Accessibility-App/1.0"):
        self.base_url = "https://nominatim.openstreetmap.org/search"
        self.headers = {
            "User-Agent": user_agent
        }

    def geocode(self, address: str) -> Optional[Dict[str, Any]]:
        """
        Geocodes a text address string into coordinates.
        Returns:
            Dict containing 'lat', 'lon', and 'display_name' if found, else None.
        """
        params = {
            "q": address,
            "format": "json",
            "limit": 1,
            "addressdetails": 1
        }
        try:
            response = requests.get(self.base_url, params=params, headers=self.headers, timeout=10)
            if response.status_code == 200:
                results = response.json()
                if results:
                    best_match = results[0]
                    return {
                        "lat": float(best_match["lat"]),
                        "lng": float(best_match["lon"]),
                        "display_name": best_match["display_name"]
                    }
            else:
                print(f"[Geocoder] Nominatim error {response.status_code}: {response.text}")
        except Exception as e:
            print(f"[Geocoder] Exception occurred during geocoding: {e}")
        return None
