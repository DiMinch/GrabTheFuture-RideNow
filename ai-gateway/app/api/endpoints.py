from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
import asyncio
import json

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
    Accepts an SDP offer from the client, negotiates the session, 
    and returns the SDP answer.
    """
    if not payload.sdpOffer:
        raise HTTPException(status_code=400, detail="Missing sdpOffer")
    
    # Mock SDP negotiation (to be completed with aiortc or custom WebRTC signaling)
    mock_sdp_answer = payload.sdpOffer.replace("offer", "answer")
    mock_session_id = f"sess_{payload.userId}_{int(asyncio.get_event_loop().time())}"

    return WebRTCSessionResponse(
        sdpAnswer=mock_sdp_answer,
        sessionId=mock_session_id
    )

@router.websocket("/ai/stream/{session_id}")
async def voice_stream_websocket(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for bidirectional streaming of audio packets.
    Translates mobile audio chunks into Gemini Live API format and vice versa.
    """
    await websocket.accept()
    print(f"[AI-Gateway] WebSocket client connected: {session_id}")

    try:
        # TODO: Initialize connection to Gemini Multimodal Live API using google-generativeai SDK
        # Example:
        # async with client.aio.live.connect(model="gemini-2.0-flash-exp") as session:
        #     ...
        
        while True:
            # Receive audio/command JSON from mobile app
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Forward binary audio packets or texts to Gemini Live Session
            print(f"[AI-Gateway] Received packet: {message.get('type')}")
            
            # Mock echo response back to mobile app
            response_payload = {
                "type": "audio",
                "data": message.get("data"), # echo back or TTS placeholder
                "text": "Phản hồi giả định từ Gemini Voice Agent"
            }
            await websocket.send_text(json.dumps(response_payload))
            
    except WebSocketDisconnect:
        print(f"[AI-Gateway] WebSocket client disconnected: {session_id}")
    except Exception as e:
        print(f"[AI-Gateway] Error in AI stream: {e}")
        await websocket.close()
