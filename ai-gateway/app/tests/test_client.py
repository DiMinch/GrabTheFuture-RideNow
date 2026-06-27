import asyncio
import websockets
import json
import base64
import wave

WS_URL = "ws://localhost:8000/api/ai/stream/session_test_001?lat=10.762622&lng=106.660172&userId=rider_test&lang=vi"

async def receive_messages(websocket):
    audio_frames = []
    try:
        while True:
            # Nếu đã bắt đầu nhận audio chunks, đặt timeout 8 giây để đóng socket khi hết tiếng (tránh ngắt sớm khi đang gọi tool/chờ kết quả)
            timeout = 8.0 if len(audio_frames) > 0 else None
            try:
                message = await asyncio.wait_for(websocket.recv(), timeout=timeout)
            except asyncio.TimeoutError:
                print("\n[Client] Không nhận thêm dữ liệu mới trong 3 giây. Đang đóng kết nối để lưu file...")
                break
                
            payload = json.loads(message)
            msg_type = payload.get("type")
            
            print(f"\n[Gateway -> Client] Nhận gói tin dạng: {msg_type}")
            
            # Nếu nhận được transcript của trợ lý
            if "text" in payload:
                print(f"  > Trợ lý dịch: {payload['text']}")
                
            # Nếu nhận được tín hiệu kích hoạt hành động đặt xe / geocode
            if msg_type == "action_result":
                tool_name = payload.get('tool')
                print(f"  > Tác vụ: {tool_name}")
                print(f"  > Kết quả từ Backend: {payload.get('result')}")
                
            # Nếu nhận được audio phản hồi dạng base64
            elif msg_type == "audio" or "data" in payload:
                audio_data = payload.get("data", "")
                audio_len = len(audio_data)
                print(f"  > Nhận audio chunk dài {audio_len} ký tự base64")
                if audio_data:
                    try:
                        audio_frames.append(base64.b64decode(audio_data))
                    except Exception as e:
                        print(f"  > Lỗi decode base64: {e}")
                
    except websockets.exceptions.ConnectionClosed:
        print("[Listener] Kết nối WebSocket đã đóng.")
    finally:
        if audio_frames:
            try:
                # Gemini Live default output is 24kHz 16-bit Mono PCM
                out_path = "app/tests/response_voice.wav"
                with wave.open(out_path, "wb") as wf:
                    wf.setnchannels(1)
                    wf.setsampwidth(2)
                    wf.setframerate(24000)
                    wf.writeframes(b"".join(audio_frames))
                print(f"\n[Client] Đã lưu thành công file phản hồi âm thanh của trợ lý vào: {out_path}")
            except Exception as e:
                print(f"\n[Client] Lỗi lưu file âm thanh phản hồi: {e}")

async def send_messages(websocket):
    # 1. Gửi ngữ cảnh GPS khởi tạo
    context_msg = {
        "type": "session_context",
        "latitude": 10.762622,
        "longitude": 106.660172,
        "lang": "vi"
    }
    await websocket.send(json.dumps(context_msg))
    print("[Client -> Gateway] Đã gửi ngữ cảnh vị trí GPS.")
    await asyncio.sleep(1)
    # 2. Đọc file ghi âm mẫu và stream dạng chunk
    wav_path = "app/tests/voice_sample_4.wav"
    try:
        with wave.open(wav_path, "rb") as wf:
            # Kiểm tra định dạng file WAV để cảnh báo nếu sai tần số
            sample_rate = wf.getframerate()
            channels = wf.getnchannels()
            if sample_rate != 16000 or channels != 1:
                print(f"[Cảnh báo] File WAV nên có tần số 16000Hz và 1 kênh (Mono). Hiện tại: {sample_rate}Hz, {channels} kênh.")
            # Đọc từng chunk tương ứng với 0.2 giây âm thanh (6400 bytes cho 16kHz 16-bit mono)
            chunk_size = 6400 
            data = wf.readframes(chunk_size // 2) # readframes nhận số lượng frame (mỗi frame 2 bytes)
            
            print("[Client -> Gateway] Bắt đầu stream file âm thanh giọng nói thật...")
            while len(data) > 0:
                # Mã hóa base64 dữ liệu PCM thô (bỏ qua header WAV 44 bytes đầu tiên)
                # Thư viện wave.readframes() trả về dữ liệu thô nên ta encode trực tiếp
                b64_data = base64.b64encode(data).decode("utf-8")
                
                audio_msg = {
                    "type": "audio_chunk",
                    "data": b64_data
                }
                await websocket.send(json.dumps(audio_msg))
                
                # Đọc tiếp chunk tiếp theo
                data = wf.readframes(chunk_size // 2)
                # Giả lập thời gian thực trễ 0.2 giây giữa các chunk
                await asyncio.sleep(0.2)
                
            # 3. Gửi tín hiệu kết thúc nói (Gateway sẽ tự động chèn thêm silence để kích hoạt VAD)
            end_msg = {"type": "audio_end"}
            await websocket.send(json.dumps(end_msg))
            print("[Client -> Gateway] Đã truyền xong file và gửi sự kiện kết thúc âm thanh (audio_end).")
            
    except FileNotFoundError:
        print(f"[Lỗi] Không tìm thấy file âm thanh mẫu tại: {wav_path}")

async def main():
    print(f"Đang kết nối tới: {WS_URL}")
    try:
        async with websockets.connect(WS_URL) as websocket:
            print("Kết nối thành công!")
            
            # Chạy song song cả hai tác vụ nhận và gửi dữ liệu
            await asyncio.gather(
                receive_messages(websocket),
                send_messages(websocket)
            )
    except Exception as e:
        print(f"Lỗi kết nối: {e}")

if __name__ == "__main__":
    asyncio.run(main())
