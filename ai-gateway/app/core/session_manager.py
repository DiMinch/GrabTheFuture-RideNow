import asyncio
from datetime import datetime
from typing import Dict, Optional
from pydantic import BaseModel
from app.services.gemini import GeminiLiveService

class SessionInfo(BaseModel):
    session_id: str
    user_id: str
    latitude: float
    longitude: float
    lang: str
    created_at: datetime
    
    class Config:
        arbitrary_types_allowed = True

class SessionManager:
    """
    Manages active voice streaming sessions to ensure clean lifecycles
    and prevent memory leaks.
    """
    def __init__(self):
        self.active_sessions: Dict[str, SessionInfo] = {}
        self.active_tasks: Dict[str, asyncio.Task] = {}

    def register_session(self, session_id: str, user_id: str, lat: float, lng: float, lang: str) -> SessionInfo:
        """
        Registers a new active session in the manager.
        """
        session_info = SessionInfo(
            session_id=session_id,
            user_id=user_id,
            latitude=lat,
            longitude=lng,
            lang=lang,
            created_at=datetime.utcnow()
        )
        self.active_sessions[session_id] = session_info
        print(f"[SessionManager] Registered session: {session_id} for user: {user_id}")
        return session_info

    def update_location(self, session_id: str, lat: float, lng: float):
        """
        Updates the location context of an active session.
        """
        if session_id in self.active_sessions:
            session = self.active_sessions[session_id]
            session.latitude = lat
            session.longitude = lng

    def update_language(self, session_id: str, lang: str):
        """
        Updates the locale setting of an active session.
        """
        if session_id in self.active_sessions:
            session = self.active_sessions[session_id]
            session.lang = lang

    def register_task(self, session_id: str, task: asyncio.Task):
        """
        Registers a background asyncio task associated with a session.
        """
        self.active_tasks[session_id] = task

    def remove_session(self, session_id: str):
        """
        Cleans up and removes an active session and cancels any pending tasks.
        """
        if session_id in self.active_sessions:
            del self.active_sessions[session_id]
            print(f"[SessionManager] Removed session data: {session_id}")
        
        if session_id in self.active_tasks:
            task = self.active_tasks[session_id]
            if not task.done():
                task.cancel()
                print(f"[SessionManager] Cancelled background task for session: {session_id}")
            del self.active_tasks[session_id]

# Singleton instance for application-wide use
session_manager = SessionManager()
