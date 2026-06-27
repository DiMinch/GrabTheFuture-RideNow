import pytest
from app.services.geocoder import NominatimGeocoder

@pytest.mark.asyncio
async def test_geocode_success():
    """Đảm bảo Nominatim API phân tích đúng địa chỉ sang tọa độ."""
    geocoder = NominatimGeocoder()
    result = geocoder.geocode("Ben Thanh Market, Ho Chi Minh")
    
    assert isinstance(result, dict)
    assert "lat" in result
    assert "lng" in result
    assert isinstance(result["lat"], float)
    assert isinstance(result["lng"], float)

@pytest.mark.asyncio
async def test_geocode_empty_address():
    """Đảm bảo API xử lý mượt mà khi người dùng truyền chuỗi rỗng."""
    geocoder = NominatimGeocoder()
    result = geocoder.geocode("")
    assert result is None

