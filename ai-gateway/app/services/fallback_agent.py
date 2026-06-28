import io
import os
import base64
import wave
import httpx
from gtts import gTTS
from app.core.config import settings
from app.core.prompts import get_system_instruction
from app.services.tool_executor import execute_tool

class FallbackAgentService:
    """
    Fallback Voice Agent Service.
    Used when Gemini Live API is rate-limited or unavailable.
    Uses Gemini 1.5 Flash REST API (which natively transcribes audio) and gTTS for speech synthesis.
    """
    def __init__(self, api_key: str, context: dict = None):
        self.api_key = api_key
        self.context = context or {}
        # Dùng model cấu hình động từ settings để tránh lỗi không tìm thấy model
        model_name = settings.GEMINI_MODEL
        self.model_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
        
        # Audio accumulator for raw PCM bytes (from Mobile client)
        self.audio_buffer = bytearray()
        
    def add_audio_chunk(self, base64_chunk: str):
        """
        Accumulates incoming base64 PCM 16kHz audio chunks.
        """
        try:
            pcm_bytes = base64.b64decode(base64_chunk)
            self.audio_buffer.extend(pcm_bytes)
        except Exception as e:
            print(f"[FallbackAgent] Error decoding audio chunk: {e}")

    def clear_buffer(self):
        """Resets the accumulated audio buffer."""
        self.audio_buffer = bytearray()

    def _convert_pcm_to_wav(self) -> bytes:
        """
        Wraps raw 16kHz 16-bit mono PCM bytes in a WAV header.
        """
        wav_io = io.BytesIO()
        with wave.open(wav_io, 'wb') as wav_file:
            wav_file.setnchannels(1)      # Mono
            wav_file.setsampwidth(2)     # 16-bit (2 bytes)
            wav_file.setframerate(16000) # 16kHz
            wav_file.writeframes(self.audio_buffer)
        return wav_io.getvalue()

    async def process_turn(self) -> dict:
        """
        Sends accumulated audio to Gemini 1.5 Flash REST API,
        gets the response, executes tools if requested, and synthesizes speech using gTTS.
        Returns:
            A dict containing 'text_response' and 'audio_base64'.
        """
        if not self.audio_buffer:
            return {"error": "Empty audio buffer"}

        mime_type = self.context.get("mimeType", "audio/wav")
        if mime_type == "audio/pcm" or (mime_type == "audio/wav" and not self.audio_buffer.startswith(b'RIFF')):
            audio_bytes = self._convert_pcm_to_wav()
        else:
            audio_bytes = bytes(self.audio_buffer)

        self.clear_buffer() # Reset buffer for next turn

        # Base64 encode WAV for Gemini API payload
        wav_b64 = base64.b64encode(audio_bytes).decode("utf-8")

        # Get system instructions based on language & coordinates
        lang = self.context.get("lang", "vi")
        lat = self.context.get("latitude", 10.762622)
        lng = self.context.get("longitude", 106.660172)
        system_instruction = get_system_instruction(lang, lat, lng)

        # Define tools for fallback REST API
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
                                "pickup_lat": { "type": "NUMBER" },
                                "pickup_lng": { "type": "NUMBER" },
                                "dropoff_lat": { "type": "NUMBER" },
                                "dropoff_lng": { "type": "NUMBER" },
                                "dropoff_address": { "type": "STRING" }
                            },
                            "required": ["pickup_lat", "pickup_lng", "dropoff_lat", "dropoff_lng", "dropoff_address"]
                        }
                    }
                ]
            }
        ]

        # Construct payload for Gemini REST API
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "inlineData": {
                                "mimeType": mime_type if mime_type != "audio/pcm" else "audio/wav",
                                "data": wav_b64
                            }
                        },
                        {
                            "text": "Hãy lắng nghe đoạn âm thanh này từ người dùng khiếm thị và phản hồi lại phù hợp theo đúng quy tắc chỉ thị hệ thống."
                        }
                    ]
                }
            ],
            "systemInstruction": {
                "parts": [{"text": system_instruction}]
            },
            "tools": tools
        }

        headers = {
            "Content-Type": "application/json"
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.model_url}?key={self.api_key}",
                    json=payload,
                    headers=headers,
                    timeout=30
                )
                
                if response.status_code != 200:
                    print(f"[FallbackAgent] Gemini REST API error: {response.text}")
                    return {"error": "Failed to generate content from Gemini"}

                response_data = response.json()
                candidates = response_data.get("candidates", [])
                if not candidates:
                    return {"error": "No response candidates generated"}

                parts = candidates[0].get("content", {}).get("parts", [])
                
                text_response = ""
                tool_calls = []

                for part in parts:
                    if "text" in part:
                        text_response += part["text"]
                    elif "functionCall" in part:
                        tool_calls.append(part["functionCall"])

                # Handle tool calls if returned
                if tool_calls:
                    for call in tool_calls:
                        name = call.get("name")
                        args = call.get("args", {})
                        
                        # Execute tool call
                        result_dict = await execute_tool(name, args, self.context)
                        
                        # Return details of tool execution so FE can display state
                        return {
                            "type": "action_result",
                            "tool": name,
                            "result": result_dict,
                            "text_response": f"Đang thực hiện yêu cầu: {name}..."
                        }

                # Synthesize text response to audio using gTTS
                if not text_response:
                    text_response = "Tôi nghe chưa rõ, bạn có thể nói lại được không?"

                # Generate speech
                tts = gTTS(text=text_response, lang=lang)
                tts_io = io.BytesIO()
                tts.write_to_fp(tts_io)
                tts_bytes = tts_io.getvalue()
                
                audio_base64 = base64.b64encode(tts_bytes).decode("utf-8")

                return {
                    "type": "fallback_response",
                    "text_response": text_response,
                    "audio_base64": audio_base64
                }

        except Exception as e:
            print(f"[FallbackAgent] Exception in process_turn: {e}")
            return {"error": f"Internal fallback error: {str(e)}"}
