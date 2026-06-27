from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from pydantic import BaseModel
import asyncio
import json
from app.core.config import settings
from app.services.gemini import GeminiLiveService
from app.core.session_manager import session_manager

router = APIRouter()

class WebRTCSessionRequest(BaseModel):
    sdpOffer: str
    userId: str

class WebRTCSessionResponse(BaseModel):
    sdpAnswer: str
    sessionId: str

@router.post("/ai/session", response_model=WebRTCSessionResponse)
async def init_webrtc_session(payload: WebRTCSessionRequest):
    """
    Endpoint to establish a WebRTC Peer Connection.
    """
    if not payload.sdpOffer:
        raise HTTPException(status_code=400, detail="Missing sdpOffer")
    
    mock_sdp_answer = payload.sdpOffer.replace("offer", "answer")
    mock_session_id = f"sess_{payload.userId}_{int(asyncio.get_event_loop().time())}"

    return WebRTCSessionResponse(
        sdpAnswer=mock_sdp_answer,
        sessionId=mock_session_id
    )

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from pydantic import BaseModel
import asyncio
import json
from app.core.config import settings
from app.services.gemini import GeminiLiveService
from app.services.fallback_agent import FallbackAgentService
from app.core.session_manager import session_manager

router = APIRouter()

class WebRTCSessionRequest(BaseModel):
    sdpOffer: str
    userId: str

class WebRTCSessionResponse(BaseModel):
    sdpAnswer: str
    sessionId: str

@router.post("/ai/session", response_model=WebRTCSessionResponse)
async def init_webrtc_session(payload: WebRTCSessionRequest):
    """
    Endpoint to establish a WebRTC Peer Connection.
    """
    if not payload.sdpOffer:
        raise HTTPException(status_code=400, detail="Missing sdpOffer")
    
    mock_sdp_answer = payload.sdpOffer.replace("offer", "answer")
    mock_session_id = f"sess_{payload.userId}_{int(asyncio.get_event_loop().time())}"

    return WebRTCSessionResponse(
        sdpAnswer=mock_sdp_answer,
        sessionId=mock_session_id
    )

@router.websocket("/ai/stream/{session_id}")
async def voice_stream_websocket(
    websocket: WebSocket, 
    session_id: str,
    lat: float = Query(10.762622),
    lng: float = Query(106.660172),
    userId: str = Query("guest"),
    lang: str = Query("vi")
):
    """
    WebSocket endpoint for bidirectional streaming of audio packets.
    Translates mobile audio chunks into Gemini Live API format and vice versa.
    If USE_FALLBACK_AGENT is configured, uses the REST-based FallbackAgentService.
    """
    await websocket.accept()
    
    # Register session in manager
    session_manager.register_session(session_id, userId, lat, lng, lang)

    # Build location & language context
    context = {
        "latitude": lat,
        "longitude": lng,
        "userId": userId,
        "sessionId": session_id,
        "lang": lang
    }

    if settings.USE_FALLBACK_AGENT:
        print(f"[AI-Gateway] Initiating connection in FALLBACK mode for session {session_id}")
        fallback_service = FallbackAgentService(api_key=settings.GEMINI_API_KEY, context=context)
        
        try:
            while True:
                # Set a 5-minute idle timeout on client packets
                raw_data = await asyncio.wait_for(websocket.receive_text(), timeout=300.0)
                message = json.loads(raw_data)
                msg_type = message.get("type")

                if msg_type == "session_context":
                    new_lat = message.get("latitude")
                    new_lng = message.get("longitude")
                    new_lang = message.get("lang")
                    if new_lat and new_lng:
                        fallback_service.context["latitude"] = new_lat
                        fallback_service.context["longitude"] = new_lng
                        session_manager.update_location(session_id, new_lat, new_lng)
                    if new_lang:
                        fallback_service.context["lang"] = new_lang
                        session_manager.update_language(session_id, new_lang)

                elif msg_type == "audio_chunk" or msg_type == "audio":
                    audio_data = message.get("data")
                    if audio_data:
                        fallback_service.add_audio_chunk(audio_data)

                elif msg_type == "audio_end":
                    print(f"[AI-Gateway-Fallback] Audio finished. Generating reply...")
                    response_payload = await fallback_service.process_turn()
                    
                    if "error" in response_payload:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": response_payload["error"]
                        }))
                    else:
                        # Send base64 audio response if available
                        if "audio_base64" in response_payload:
                            await websocket.send_text(json.dumps({
                                "type": "audio",
                                "data": response_payload["audio_base64"],
                                "text": response_payload.get("text_response", "")
                            }))
                        else:
                            # Forward action / execution results to client
                            await websocket.send_text(json.dumps(response_payload))

        except asyncio.TimeoutError:
            print(f"[AI-Gateway-Fallback] Session {session_id} timed out due to inactivity.")
        except WebSocketDisconnect:
            print(f"[AI-Gateway-Fallback] Client disconnected: {session_id}")
        except Exception as e:
            print(f"[AI-Gateway-Fallback] Stream error for session {session_id}: {e}")
        finally:
            session_manager.remove_session(session_id)
            print(f"[AI-Gateway-Fallback] Stream cleanup completed for session: {session_id}")
            
    else:
        print(f"[AI-Gateway] Initiating connection in LIVE mode for session {session_id}")
        # Queues for data flow
        incoming_audio_queue = asyncio.Queue()
        outgoing_payload_queue = asyncio.Queue()

        # Initialize Gemini Live Service
        gemini_service = GeminiLiveService(
            api_key=settings.GEMINI_API_KEY,
            model=settings.GEMINI_MODEL,
            context=context
        )

        # Core proxy bridging tasks
        gemini_task = asyncio.create_task(
            gemini_service.connect_and_stream(incoming_audio_queue, outgoing_payload_queue)
        )
        
        # Register task in session manager for lifecycle management
        session_manager.register_task(session_id, gemini_task)

        async def send_to_mobile():
            """Reads payload chunks from outgoing queue and relays them to the client app."""
            try:
                while True:
                    payload = await outgoing_payload_queue.get()
                    await websocket.send_text(json.dumps(payload))
                    outgoing_payload_queue.task_done()
            except asyncio.CancelledError:
                pass
            except Exception as e:
                print(f"[AI-Gateway] Error relaying payload to client: {e}")

        send_task = asyncio.create_task(send_to_mobile())

        try:
            while True:
                # Set a 5-minute idle timeout on client packets
                raw_data = await asyncio.wait_for(websocket.receive_text(), timeout=300.0)
                message = json.loads(raw_data)
                msg_type = message.get("type")

                if msg_type == "session_context":
                    new_lat = message.get("latitude")
                    new_lng = message.get("longitude")
                    new_lang = message.get("lang")
                    if new_lat and new_lng:
                        gemini_service.context["latitude"] = new_lat
                        gemini_service.context["longitude"] = new_lng
                        session_manager.update_location(session_id, new_lat, new_lng)
                        print(f"[AI-Gateway] Updated GPS context: ({new_lat}, {new_lng})")
                    if new_lang:
                        gemini_service.context["lang"] = new_lang
                        session_manager.update_language(session_id, new_lang)
                        print(f"[AI-Gateway] Updated Language context: {new_lang}")

                elif msg_type == "audio_chunk" or msg_type == "audio":
                    # Add base64 audio chunk to Gemini queue
                    audio_data = message.get("data")
                    if audio_data:
                        await incoming_audio_queue.put(audio_data)

                elif msg_type == "audio_end":
                    print(f"[AI-Gateway] Received audio_end marker from client. Sending sentinel to stream task.")
                    await incoming_audio_queue.put("END")

        except asyncio.TimeoutError:
            print(f"[AI-Gateway] Session {session_id} timed out due to inactivity.")
        except WebSocketDisconnect:
            print(f"[AI-Gateway] Client disconnected: {session_id}")
        except Exception as e:
            print(f"[AI-Gateway] Stream error for session {session_id}: {e}")
        finally:
            # Cancel tasks and clean up
            send_task.cancel()
            
            # Session manager handles cleanup and gemini task cancellation
            session_manager.remove_session(session_id)
            
            # Await send task cancel completion
            try:
                await send_task
            except Exception:
                pass
            
            print(f"[AI-Gateway] Stream cleanup completed for session: {session_id}")


