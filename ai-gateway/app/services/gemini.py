import os
import asyncio
import websockets
import json

class GeminiLiveService:
    """
    Service wrapper for Gemini Multimodal Live API connections.
    Manages low-latency audio streaming and instruction feeding.
    """
    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model
        # URI for Gemini Live WebSockets (Gemini Multimodal Live API)
        self.host_uri = f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key={self.api_key}"

    async def connect_and_stream(self, incoming_audio_queue: asyncio.Queue, outgoing_audio_queue: asyncio.Queue):
        """
        Connects bidirectionally to Gemini Live API.
        Reads incoming chunks from mobile app, uploads to Gemini,
        receives Gemini response audio chunks, and pushes to outgoing queue.
        """
        if not self.api_key:
            print("[Gemini] API Key missing. Skipping connection.")
            return

        async with websockets.connect(self.host_uri) as gemini_ws:
            print("[Gemini] Connected to Gemini Multimodal Live API.")
            
            # Send initial configuration session setup
            setup_message = {
                "setup": {
                    "model": f"models/{self.model}",
                    "generationConfig": {
                        "responseModalities": ["AUDIO"],
                        "speechConfig": {
                            "voiceConfig": {
                                "prebuiltVoiceConfig": {
                                    "voiceName": "Puck" # Or Aoede, Fenrir, Kore, Puck
                                }
                            }
                        }
                    },
                    "systemInstruction": {
                        "parts": [
                            {"text": "Bạn là Trợ lý giọng nói RideNow dành cho người khiếm thị. Hãy giúp họ đặt xe ôm công nghệ nhanh chóng. Nhận diện điểm đến của họ và trả lời cực kỳ ngắn gọn, ấm áp qua giọng nói."}
                        ]
                    }
                }
            }
            await gemini_ws.send(json.dumps(setup_message))

            async def send_loop():
                try:
                    while True:
                        # Fetch audio chunk from incoming queue
                        chunk = await incoming_audio_queue.get()
                        
                        # Pack into Gemini Live API payload
                        payload = {
                            "realtimeInput": {
                                "mediaChunks": [
                                    {
                                        "mimeType": "audio/pcm;rate=16000",
                                        "data": chunk # Base64 encoded PCM 16kHz audio
                                    }
                                ]
                            }
                        }
                        await gemini_ws.send(json.dumps(payload))
                        incoming_audio_queue.task_done()
                except Exception as e:
                    print(f"[Gemini] Send loop error: {e}")

            async def receive_loop():
                try:
                    async for response in gemini_ws:
                        data = json.loads(response)
                        
                        # Process response chunks (audio bytes output)
                        if "serverContent" in data:
                            parts = data["serverContent"].get("modelTurn", {}).get("parts", [])
                            for part in parts:
                                if "inlineData" in part:
                                    audio_base64 = part["inlineData"].get("data")
                                    if audio_base64:
                                        # Queue audio bytes to send back to mobile app
                                        await outgoing_audio_queue.put(audio_base64)
                except Exception as e:
                    print(f"[Gemini] Receive loop error: {e}")

            # Run loops in parallel
            await asyncio.gather(send_loop(), receive_loop())
