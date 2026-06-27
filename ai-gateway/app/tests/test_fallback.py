import pytest
import base64
from app.services.fallback_agent import FallbackAgentService

@pytest.mark.asyncio
async def test_fallback_process_empty_audio():
    """Đảm bảo Fallback từ chối xử lý khi không có dữ liệu âm thanh."""
    service = FallbackAgentService(api_key="mock_key")
    result = await service.process_turn()
    
    assert "error" in result
    assert result["error"] == "Empty audio buffer"

def test_fallback_convert_pcm_to_wav():
    """Đảm bảo thuật toán gói PCM 16kHz vào WAV header chuẩn xác."""
    service = FallbackAgentService(api_key="mock_key")
    
    # Giả lập gửi 1 giây âm thanh tĩnh
    dummy_pcm = b'\x00\x00' * 16000
    dummy_b64 = base64.b64encode(dummy_pcm).decode("utf-8")
    
    service.add_audio_chunk(dummy_b64)
    
    # Kiểm tra thuật toán render WAV
    wav_bytes = service._convert_pcm_to_wav()
    
    # WAV Header luôn bắt đầu bằng RIFF và có chữ WAVE
    assert wav_bytes.startswith(b"RIFF")
    assert b"WAVE" in wav_bytes
