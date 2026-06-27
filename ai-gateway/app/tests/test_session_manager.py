import pytest
import asyncio
from app.core.session_manager import SessionManager

def test_register_and_update_session():
    """Đảm bảo việc đăng ký và cập nhật Context hoạt động tốt."""
    manager = SessionManager()
    session = manager.register_session("sess_1", "user_1", 10.0, 106.0, "vi")
    
    assert "sess_1" in manager.active_sessions
    assert session.lang == "vi"
    
    # Update location
    manager.update_location("sess_1", 11.0, 107.0)
    assert manager.active_sessions["sess_1"].latitude == 11.0

def test_remove_session_cleanup():
    """Đảm bảo session được xóa sạch khỏi RAM."""
    manager = SessionManager()
    manager.register_session("sess_2", "user_2", 10.0, 106.0, "en")
    
    manager.remove_session("sess_2")
    assert "sess_2" not in manager.active_sessions

@pytest.mark.asyncio
async def test_task_cancellation_on_disconnect():
    """Đảm bảo ngắt các task ngầm (Memory leak prevention) khi ngắt kết nối."""
    manager = SessionManager()
    
    async def dummy_task():
        await asyncio.sleep(10) # Task chạy ngầm dài
        
    task = asyncio.create_task(dummy_task())
    manager.register_task("sess_3", task)
    
    # Remove session => Expect the task to be cancelled
    manager.remove_session("sess_3")
    
    # Chờ event loop cập nhật trạng thái cancel
    await asyncio.sleep(0.01)
    
    assert task.cancelled() is True
