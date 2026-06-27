import requests
import unicodedata
import re
from typing import Optional, Tuple, Dict, Any

# Dictionary of key landmarks in Vietnam to guarantee 100% correct coordinates
LANDMARKS = {
    "landmark 81": {
        "lat": 10.7958270,
        "lng": 106.7225902,
        "display_name": "Vinhomes Central Park - Tòa nhà Landmark 81, Quận Bình Thạnh, Thành phố Hồ Chí Minh, Việt Nam"
    },
    "vinhomes landmark 81": {
        "lat": 10.7958270,
        "lng": 106.7225902,
        "display_name": "Vinhomes Central Park - Tòa nhà Landmark 81, Quận Bình Thạnh, Thành phố Hồ Chí Minh, Việt Nam"
    },
    "toa nha landmark 81": {
        "lat": 10.7958270,
        "lng": 106.7225902,
        "display_name": "Vinhomes Central Park - Tòa nhà Landmark 81, Quận Bình Thạnh, Thành phố Hồ Chí Minh, Việt Nam"
    },
    "cho ben thanh": {
        "lat": 10.7725301,
        "lng": 106.6980365,
        "display_name": "Chợ Bến Thành, Quận 1, Thành phố Hồ Chí Minh, Việt Nam"
    },
    "san bay tan son nhat": {
        "lat": 10.818024,
        "lng": 106.664035,
        "display_name": "Sân bay Quốc tế Tân Sơn Nhất, Quận Tân Bình, Thành phố Hồ Chí Minh, Việt Nam"
    },
    "tan son nhat": {
        "lat": 10.818024,
        "lng": 106.664035,
        "display_name": "Sân bay Quốc tế Tân Sơn Nhất, Quận Tân Bình, Thành phố Hồ Chí Minh, Việt Nam"
    },
    "nha tho duc ba": {
        "lat": 10.779782,
        "lng": 106.699026,
        "display_name": "Nhà thờ Chính tòa Đức Bà Sài Gòn, Quận 1, Thành phố Hồ Chí Minh, Việt Nam"
    },
    "dinh doc lap": {
        "lat": 10.777011,
        "lng": 106.695423,
        "display_name": "Dinh Độc Lập, Quận 1, Thành phố Hồ Chí Minh, Việt Nam"
    },
    "pho di bo nguyen hue": {
        "lat": 10.774123,
        "lng": 106.703698,
        "display_name": "Phố đi bộ Nguyễn Huệ, Quận 1, Thành phố Hồ Chí Minh, Việt Nam"
    }
}

def normalize_string(s: str) -> str:
    """Normalize string: convert to lowercase, handle accents and common typos/transcriptions."""
    if not s:
        return ""
    s = s.lower().strip()
    # Normalize transcription variations
    s = s.replace("lan mát", "landmark")
    s = s.replace("lan mat", "landmark")
    s = s.replace("len met", "landmark")
    s = s.replace("len mát", "landmark")
    # Remove accents
    s = unicodedata.normalize('NFKD', s)
    s = ''.join([c for c in s if not unicodedata.combining(c)])
    # Remove non-alphanumeric characters except spaces
    s = re.sub(r'[^a-z0-9\s]', '', s)
    # Remove extra spaces
    s = ' '.join(s.split())
    return s

class NominatimGeocoder:
    """
    Free Geocoding Service using OpenStreetMap Nominatim API.
    Does not require an API key, but requires a unique User-Agent.
    """
    def __init__(self, user_agent: str = "RideNow-Accessibility-App/1.0"):
        self.base_url = "https://nominatim.openstreetmap.org/search"
        self.reverse_url = "https://nominatim.openstreetmap.org/reverse"
        self.headers = {
            "User-Agent": user_agent
        }
        self.country_cache = {}

    def _get_country_code_by_lang(self, lang: Optional[str]) -> Optional[str]:
        if not lang:
            return None
        lang = lang.lower().strip()
        lang_map = {
            "vi": "vn",
            "vn": "vn",
            "th": "th",
            "id": "id",
            "in": "id",
            "ms": "my",
            "my": "my",
            "en": None
        }
        base_lang = lang.split("_")[0].split("-")[0]
        return lang_map.get(base_lang)

    def get_country_code(self, latitude: float, longitude: float) -> Optional[str]:
        # 1. Fast offline bounding box checks for SEA countries (Grab/RideNow core markets)
        # Vietnam: lat [8.0, 24.0], lon [102.0, 110.0]
        if 8.0 <= latitude <= 24.0 and 102.0 <= longitude <= 110.0:
            return "vn"
        # Singapore: lat [1.15, 1.48], lon [103.5, 104.5]
        if 1.15 <= latitude <= 1.48 and 103.5 <= longitude <= 104.5:
            return "sg"
        # Thailand: lat [5.5, 20.5], lon [97.0, 106.0]
        if 5.5 <= latitude <= 20.5 and 97.0 <= longitude <= 106.0:
            return "th"
        # Malaysia: Peninsular and East Malaysia
        if (1.0 <= latitude <= 7.5 and 99.0 <= longitude <= 105.0) or \
           (0.8 <= latitude <= 7.0 and 109.0 <= longitude <= 119.5):
            return "my"
        # Philippines: lat [4.5, 21.5], lon [116.5, 127.0]
        if 4.5 <= latitude <= 21.5 and 116.5 <= longitude <= 127.0:
            return "ph"
        # Indonesia: lat [-11.0, 6.0], lon [95.0, 141.0]
        if -11.0 <= latitude <= 6.0 and 95.0 <= longitude <= 141.0:
            return "id"

        # 2. Dynamic lookup via Nominatim Reverse Geocoding API with caching
        cache_key = (round(latitude, 1), round(longitude, 1))
        if cache_key in self.country_cache:
            return self.country_cache[cache_key]

        params = {
            "lat": latitude,
            "lon": longitude,
            "format": "json",
            "zoom": 5
        }
        try:
            print(f"[Geocoder] Performing reverse geocoding lookup for ({latitude}, {longitude})")
            response = requests.get(self.reverse_url, params=params, headers=self.headers, timeout=5)
            if response.status_code == 200:
                data = response.json()
                address = data.get("address", {})
                country_code = address.get("country_code")
                if country_code:
                    cc_lower = country_code.lower()
                    self.country_cache[cache_key] = cc_lower
                    return cc_lower
            else:
                print(f"[Geocoder] Reverse geocode error {response.status_code}: {response.text}")
        except Exception as e:
            print(f"[Geocoder] Reverse geocoding exception: {e}")
        return None

    def _haversine_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculates great-circle distance (km) between two GPS coordinates."""
        import math
        R = 6371.0  # Earth radius in km
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lng2 - lng1)
        a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    def normalize_vietnam_address(self, address: str) -> str:
        # Lazy import to avoid potential circular dependencies
        from app.core.config import settings

        api_key = getattr(settings, "GEOVINA_API_KEY", "")
        if not api_key:
            return address

        url = "https://geovina.io.vn/api/parse"
        headers = {
            "X-Api-Key": api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "address": address
        }
        try:
            print(f"[Geocoder] Querying GeoVina API to normalize: '{address}'")
            response = requests.post(url, json=payload, headers=headers, timeout=5)
            if response.status_code == 200:
                response_data = response.json()
                data = response_data.get("data", response_data) if isinstance(response_data, dict) else {}
                full_new_address = data.get("full_new_address")
                if full_new_address:
                    print(f"[Geocoder] GeoVina successfully normalized address to new standard: '{full_new_address}'")
                    return full_new_address
            else:
                print(f"[Geocoder] GeoVina API returned status code {response.status_code}: {response.text}")
        except Exception as e:
            print(f"[Geocoder] Exception during GeoVina address normalization: {e}")
        return address

    def geocode(
        self, 
        address: str, 
        latitude: Optional[float] = None, 
        longitude: Optional[float] = None,
        lang: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Geocodes a text address string into coordinates.
        Checks preset landmarks first to ensure high reliability.
        Returns:
            Dict containing 'lat', 'lng', and 'display_name' if found, else None.
        """
        if not address:
            return None
            
        # 1. Match against known local landmarks first
        normalized = normalize_string(address)
        for key, landmark_data in LANDMARKS.items():
            if key in normalized or normalized in key:
                print(f"[Geocoder] Landmark override match found: '{key}' for address '{address}'")
                return {
                    "lat": landmark_data["lat"],
                    "lng": landmark_data["lng"],
                    "display_name": landmark_data["display_name"]
                }
        
        # 2. Fallback to Nominatim search with dynamic GPS bias
        params = {
            "q": address,
            "format": "json",
            "limit": 1,
            "addressdetails": 1
        }
        
        country_code = None
        if latitude is not None and longitude is not None:
            # 0.5 degrees viewbox (~55km bounding box around user's GPS context)
            params["viewbox"] = f"{longitude - 0.25},{latitude + 0.25},{longitude + 0.25},{latitude - 0.25}"
            params["bounded"] = 0  # 0 means bias, 1 means strict bounding
            country_code = self.get_country_code(latitude, longitude)
            
        # Fallback to language context if country code is still not determined
        if not country_code:
            country_code = self._get_country_code_by_lang(lang)
            
        # Default fallback to Vietnam if absolutely no context is available
        if not country_code:
            country_code = "vn"
            
        # If the target country is Vietnam, run address normalization via GeoVina API (handling merged addresses)
        original_address = address
        if country_code == "vn":
            address = self.normalize_vietnam_address(address)
            
        params["countrycodes"] = country_code
        params["q"] = address
        
        # GPS_VALIDATION_THRESHOLD: if the geocoded result is farther than this (km) from
        # the user's actual GPS position, we treat it as a hallucinated/wrong address and retry.
        GPS_VALIDATION_KM = 5.0
        
        def _do_search(search_params: dict) -> Optional[Dict[str, Any]]:
            try:
                response = requests.get(self.base_url, params=search_params, headers=self.headers, timeout=10)
                if response.status_code == 200:
                    results = response.json()
                    if results:
                        best = results[0]
                        return {
                            "lat": float(best["lat"]),
                            "lng": float(best["lon"]),
                            "display_name": best["display_name"]
                        }
                else:
                    print(f"[Geocoder] Nominatim error {response.status_code}: {response.text}")
            except Exception as e:
                print(f"[Geocoder] Exception during geocoding: {e}")
            return None

        result = _do_search(params)

        # If no result found and country is Vietnam, attempt fallback by stripping ward/district segments
        if not result and country_code == "vn":
            # Fallback 1: Strip ward-level segments (e.g., Phường Bến Cờ)
            parts = [p.strip() for p in address.split(",")]
            if len(parts) > 2:
                ward_stripped = []
                for p in parts:
                    lower_p = p.lower()
                    if lower_p.startswith(("phường", "p.", "xã")):
                        continue
                    ward_stripped.append(p)
                if len(ward_stripped) < len(parts):
                    fallback_address = ", ".join(ward_stripped)
                    print(f"[Geocoder] Geocoding failed for normalized address. Retrying with ward stripped: '{fallback_address}'")
                    fallback_params = params.copy()
                    fallback_params["q"] = fallback_address
                    result = _do_search(fallback_params)
            
            # Fallback 2: Strip both ward-level and district-level segments (e.g., Phường Bến Cờ, Quận 3)
            if not result and len(parts) > 2:
                district_stripped = []
                for p in parts[:-1]:  # Keep the province/city at the end intact
                    lower_p = p.lower()
                    if lower_p.startswith(("phường", "p.", "xã", "quận", "q.", "huyện", "thị xã")):
                        continue
                    district_stripped.append(p)
                district_stripped.append(parts[-1])  # Add the province back
                if len(district_stripped) < len(parts):
                    fallback_address = ", ".join(district_stripped)
                    print(f"[Geocoder] Geocoding failed again. Retrying with ward and district stripped: '{fallback_address}'")
                    fallback_params = params.copy()
                    fallback_params["q"] = fallback_address
                    result = _do_search(fallback_params)

        return result

