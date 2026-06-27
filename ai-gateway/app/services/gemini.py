import os
import asyncio
import websockets
import json
import base64
from app.services.tool_executor import execute_tool
from app.core.prompts import get_system_instruction

class GeminiLiveService:
    """
    Service wrapper for Gemini Multimodal Live API connections.
    Manages low-latency audio streaming, instruction feeding, and tool execution.
    """
    def __init__(self, api_key: str, model: str, context: dict = None):
        self.api_key = api_key
        self.model = model
        self.context = context or {}
        # URI for Gemini Live WebSockets (Gemini Multimodal Live API)
        self.host_uri = f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key={self.api_key}"

    def _get_setup_message(self) -> dict:
        """
        Generates the initial configuration setup message for Gemini Live.
        Dynamically adjusts instructions based on language ('vi' or 'en') and
        GPS coordinates passed from the mobile frontend.
        """
        lat = self.context.get("latitude", 10.762622)
        lng = self.context.get("longitude", 106.660172)
        lang = self.context.get("lang", "vi").lower()
        
        system_instruction = get_system_instruction(lang, lat, lng)


        tools = [
            {
                "functionDeclarations": [
                    {
                        "name": "geocode_address",
                        "description": "Chuyển địa điểm/địa chỉ bằng chữ sang tọa độ GPS.",
                        "parameters": {
                            "type": "OBJECT",
                            "properties": {
                                "address": {
                                    "type": "STRING",
                                    "description": "Địa chỉ hoặc tên địa điểm hành khách muốn đến."
                                }
                            },
                            "required": ["address"]
                        }
                    },
                    {
                        "name": "create_booking",
                        "description": "Đặt xe với tọa độ đón (pickup) và tọa độ đến (dropoff).",
                        "parameters": {
                            "type": "OBJECT",
                            "properties": {
                                "pickup_lat": {
                                    "type": "NUMBER",
                                    "description": "Vĩ độ điểm đón."
                                },
                                "pickup_lng": {
                                    "type": "NUMBER",
                                    "description": "Kinh độ điểm đón."
                                },
                                "dropoff_lat": {
                                    "type": "NUMBER",
                                    "description": "Vĩ độ điểm đến."
                                },
                                "dropoff_lng": {
                                    "type": "NUMBER",
                                    "description": "Kinh độ điểm đến."
                                },
                                "dropoff_address": {
                                    "type": "STRING",
                                    "description": "Địa chỉ bằng chữ của điểm đến."
                                }
                            },
                            "required": ["pickup_lat", "pickup_lng", "dropoff_lat", "dropoff_lng", "dropoff_address"]
                        }
                    }
                ]
            }
        ]

        return {
            "setup": {
                "model": f"models/{self.model}",
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
                    "speechConfig": {
                        "voiceConfig": {
                            "prebuiltVoiceConfig": {
                                "voiceName": "Puck"
                            }
                        }
                    }
                },
                "systemInstruction": {
                    "parts": [
                        {"text": system_instruction}
                    ]
                },
                "tools": tools,
                "outputAudioTranscription": {}
            }
        }

    async def connect_and_stream(self, incoming_audio_queue: asyncio.Queue, outgoing_payload_queue: asyncio.Queue):
        """
        Connects bidirectionally to Gemini Live API.
        Reads incoming chunks from mobile app, uploads to Gemini,
        receives response audio chunks or tool calls, and pushes outputs to queue.
        """
        if not self.api_key:
            print("[Gemini] API Key missing. Skipping connection.")
            return

        async with websockets.connect(self.host_uri) as gemini_ws:
            print("[Gemini] Connected to Gemini Multimodal Live API.")
            
            # Send setup configuration
            setup_msg = self._get_setup_message()
            await gemini_ws.send(json.dumps(setup_msg))

            async def send_loop():
                try:
                    while True:
                        chunk = await incoming_audio_queue.get()
                        
                        # Stop loop if end of stream sentinel is received
                        if chunk is None or chunk == "END":
                            # Inject 0.6 seconds of silence (3 chunks of 0.2s) to trigger VAD on Gemini side
                            print("[Gemini] Client finished speaking. Injecting silence chunks to trigger VAD...")
                            silence_data = base64.b64encode(b'\x00' * 6400).decode("utf-8")
                            for _ in range(3):
                                silence_payload = {
                                    "realtimeInput": {
                                        "audio": {
                                            "mimeType": "audio/pcm;rate=16000",
                                            "data": silence_data
                                        }
                                    }
                                }
                                await gemini_ws.send(json.dumps(silence_payload))
                                await asyncio.sleep(0.2)

                            # Signal Gemini that the user has finished speaking
                            await gemini_ws.send(json.dumps({
                                "clientContent": {
                                    "turnComplete": True
                                }
                            }))
                            incoming_audio_queue.task_done()
                            break
                        
                        # Pack into Gemini Live API payload
                        payload = {
                            "realtimeInput": {
                                "audio": {
                                    "mimeType": "audio/pcm;rate=16000",
                                    "data": chunk # Base64 encoded PCM 16kHz audio
                                }
                            }
                        }
                        await gemini_ws.send(json.dumps(payload))
                        incoming_audio_queue.task_done()
                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    print(f"[Gemini] Send loop error: {e}")

            async def receive_loop():
                try:
                    async for response in gemini_ws:
                        data = json.loads(response)
                        # Print raw message keys for debugging
                        print(f"[Gemini -> Gateway] Received message with keys: {list(data.keys())}")
                        
                        # 1. Process standard audio/text responses
                        if "serverContent" in data:
                            model_turn = data["serverContent"].get("modelTurn", {})
                            parts = model_turn.get("parts", [])
                            for part in parts:
                                if "text" in part:
                                    text_val = part.get("text")
                                    print(f"[Gemini] Text transcript: {text_val}")
                                    await outgoing_payload_queue.put({
                                        "type": "text",
                                        "text": text_val
                                    })
                                if "inlineData" in part:
                                    audio_base64 = part["inlineData"].get("data")
                                    if audio_base64:
                                        await outgoing_payload_queue.put({
                                            "type": "audio",
                                            "data": audio_base64
                                        })
                        
                        # 2. Process function calls (tool requests) from Gemini
                        elif "toolCall" in data:
                            function_calls = data["toolCall"].get("functionCalls", [])
                            for call in function_calls:
                                call_id = call.get("id")
                                name = call.get("name")
                                args = call.get("args", {})
                                
                                # Execute function call (returns a native dict)
                                result_dict = await execute_tool(name, args, self.context)
                                
                                # Send result back to Gemini
                                tool_response_msg = {
                                    "toolResponse": {
                                        "functionResponses": [
                                            {
                                                "response": {"output": result_dict},
                                                "id": call_id,
                                                "name": name # Required by Gemini schema
                                            }
                                        ]
                                    }
                                }
                                await gemini_ws.send(json.dumps(tool_response_msg))
                                
                                # Also notify the mobile client about the execution results
                                await outgoing_payload_queue.put({
                                    "type": "action_result",
                                    "tool": name,
                                    "result": result_dict
                                })
                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    print(f"[Gemini] Receive loop error: {e}")

            # Run loops in parallel
            send_task = asyncio.create_task(send_loop())
            recv_task = asyncio.create_task(receive_loop())
            
            try:
                await asyncio.gather(send_task, recv_task)
            finally:
                send_task.cancel()
                recv_task.cancel()
