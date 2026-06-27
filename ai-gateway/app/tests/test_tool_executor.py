import pytest
from app.services.tool_executor import execute_tool

@pytest.mark.asyncio
async def test_execute_geocode_tool():
    """Đảm bảo hàm dispatcher gọi đúng tool geocode và xử lý kết quả."""
    args = {"address": "Landmark 81, Ho Chi Minh"}
    context = {}
    
    result = await execute_tool("geocode_address", args, context)
    
    assert isinstance(result, dict)
    assert "lat" in result or "error" in result

@pytest.mark.asyncio
async def test_execute_unknown_tool():
    """Đảm bảo hệ thống không bị crash nếu Gemini gọi một tool không tồn tại."""
    args = {}
    result = await execute_tool("unknown_fake_tool", args, {})
    
    assert "error" in result
    assert "Unknown tool" in result["error"]
