import pytest
from unittest.mock import patch, MagicMock
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

def test_get_country_code_offline():
    """Đảm bảo phân tích mã quốc gia offline dựa trên bounding box cho các nước SEA."""
    geocoder = NominatimGeocoder()
    
    # Vietnam
    assert geocoder.get_country_code(10.762622, 106.660172) == "vn"
    # Singapore
    assert geocoder.get_country_code(1.3521, 103.8198) == "sg"
    # Thailand
    assert geocoder.get_country_code(13.7563, 100.5018) == "th"
    # Malaysia (KL)
    assert geocoder.get_country_code(3.1390, 101.6869) == "my"
    # Philippines (Manila)
    assert geocoder.get_country_code(14.5995, 120.9842) == "ph"
    # Indonesia (Jakarta)
    assert geocoder.get_country_code(-6.2088, 106.8456) == "id"

def test_get_country_code_reverse_geocode_and_cache():
    """Đảm bảo gọi Nominatim reverse API và lưu cache cho các tọa độ ngoài SEA."""
    geocoder = NominatimGeocoder()
    
    # Mock requests.get response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"address": {"country_code": "fr"}}
    
    with patch("requests.get", return_value=mock_response) as mock_get:
        # First call should hit the API
        cc = geocoder.get_country_code(48.8566, 2.3522)  # Paris coordinates
        assert cc == "fr"
        mock_get.assert_called_once()
        
        # Second call to nearby coordinates should hit cache (rounded to 1 decimal place: 48.9, 2.4 vs 48.9, 2.4)
        cc_cached = geocoder.get_country_code(48.8570, 2.3525)
        assert cc_cached == "fr"
        # Assert requests.get was still called only once
        mock_get.assert_called_once()

def test_get_country_code_by_lang():
    """Đảm bảo phân tích mã quốc gia dựa trên ngôn ngữ fallback."""
    geocoder = NominatimGeocoder()
    assert geocoder._get_country_code_by_lang("vi") == "vn"
    assert geocoder._get_country_code_by_lang("vi-VN") == "vn"
    assert geocoder._get_country_code_by_lang("th") == "th"
    assert geocoder._get_country_code_by_lang("en_US") is None
    assert geocoder._get_country_code_by_lang(None) is None

def test_normalize_vietnam_address_no_key():
    """Đảm bảo không gọi GeoVina API nếu không cấu hình GEOVINA_API_KEY."""
    from app.core.config import settings
    geocoder = NominatimGeocoder()
    
    with patch.object(settings, "GEOVINA_API_KEY", ""):
        with patch("requests.post") as mock_post:
            res = geocoder.normalize_vietnam_address("Phường 5, Quận 3, TP.HCM")
            assert res == "Phường 5, Quận 3, TP.HCM"
            mock_post.assert_not_called()

def test_normalize_vietnam_address_success():
    """Đảm bảo gọi GeoVina API và chuyển đổi đúng địa chỉ cũ sang mới."""
    from app.core.config import settings
    geocoder = NominatimGeocoder()
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "status": "success",
        "data": {
            "full_old_address": "Phường 5, Quận 3, TP.HCM",
            "full_new_address": "Phường Võ Thị Sáu, Quận 3, Thành phố Hồ Chí Minh"
        }
    }
    
    with patch.object(settings, "GEOVINA_API_KEY", "mock_key"):
        with patch("requests.post", return_value=mock_response) as mock_post:
            res = geocoder.normalize_vietnam_address("Phường 5, Quận 3, TP.HCM")
            assert res == "Phường Võ Thị Sáu, Quận 3, Thành phố Hồ Chí Minh"
            mock_post.assert_called_once_with(
                "https://geovina.io.vn/api/parse",
                json={"address": "Phường 5, Quận 3, TP.HCM"},
                headers={"X-Api-Key": "mock_key", "Content-Type": "application/json"},
                timeout=5
            )

def test_haversine_distance():
    """Đảm bảo tính khoảng cách Haversine chính xác."""
    geocoder = NominatimGeocoder()
    # TP.HCM -> Hà Nội ~1,145km
    dist = geocoder._haversine_distance(10.762622, 106.660172, 21.0285, 105.8542)
    assert 1100 < dist < 1200
    # Khoảng cách 0 với cùng tọa độ
    assert geocoder._haversine_distance(10.0, 106.0, 10.0, 106.0) == 0.0

def test_geocode_gps_validation_retry():
    """Đảm bảo geocode retry với địa chỉ gốc và strict bounding khi kết quả ban đầu quá xa user GPS."""
    geocoder = NominatimGeocoder()
    # Giả lập user đang ở Quận 3, TP.HCM (10.776, 106.690)
    user_lat, user_lng = 10.776, 106.690

    # Kết quả lần 1: Nominatim trả về tọa độ xa (10km+), giống như bị hallucinate sai quận
    far_result = [{"lat": "10.870", "lon": "106.803", "display_name": "Sai địa điểm xa"}]
    # Kết quả lần 2 (retry bounded): Nominatim trả về tọa độ gần đúng
    near_result = [{"lat": "10.778", "lon": "106.691", "display_name": "Đúng địa điểm gần"}]

    call_count = {"n": 0}
    def mock_get_side_effect(url, params=None, headers=None, timeout=None):
        call_count["n"] += 1
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        if call_count["n"] == 1:
            mock_resp.json.return_value = far_result
        else:
            mock_resp.json.return_value = near_result
        return mock_resp

    with patch("requests.get", side_effect=mock_get_side_effect):
        with patch("requests.post") as mock_post:
            mock_post.return_value = MagicMock(status_code=401)
            result = geocoder.geocode("50 Cao Thắng, Phường Bến Cờ", user_lat, user_lng)

    assert result is not None
    assert result["display_name"] == "Đúng địa điểm gần"
    assert call_count["n"] == 2  # Đã gọi 2 lần: lần 1 bị reject vì xa, lần 2 retry bounded

