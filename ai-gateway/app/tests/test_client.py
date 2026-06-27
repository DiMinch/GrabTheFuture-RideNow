import asyncio
import websockets
import json
import base64

WS_URL = "ws://localhost:8000/api/ai/stream/session_test_001?lat=10.762622&lng=106.660172&userId=rider_test&lang=vi"

async def receive_messages(websocket):
    try:
        async for message in websocket:
            payload = json.loads(message)
            msg_type = payload.get("type")
            
            print(f"\n[Gateway -> Client] Nhận gói tin dạng: {msg_type}")
            
            # Nếu nhận được transcript của trợ lý
            if "text" in payload:
                print(f"  > Trợ lý dịch: {payload['text']}")
                
            # Nếu nhận được tín hiệu kích hoạt hành động đặt xe / geocode
            if msg_type == "action_result":
                print(f"  > Tác vụ: {payload.get('tool')}")
                print(f"  > Kết quả từ Backend: {payload.get('result')}")
                
            # Nếu nhận được audio phản hồi dạng base64
            elif msg_type == "audio" or "data" in payload:
                audio_len = len(payload.get("data", ""))
                print(f"  > Nhận audio chunk dài {audio_len} ký tự base64")
                
    except websockets.exceptions.ConnectionClosed:
        print("[Listener] Kết nối WebSocket đã đóng.")

async def send_messages(websocket):
    # 1. Gửi ngữ cảnh GPS hiện tại của người dùng
    context_msg = {
        "type": "session_context",
        "latitude": 10.762622,
        "longitude": 106.660172,
        "lang": "vi"
    }
    await websocket.send(json.dumps(context_msg))
    print("[Client -> Gateway] Đã gửi ngữ cảnh vị trí GPS khởi tạo.")
    await asyncio.sleep(1)

    # 2. Giả lập gửi các chunk âm thanh (PCM 16kHz)
    # Trong thực tế bạn có thể đọc từ một file ghi âm .wav thô không có header
    # Ở đây chúng ta giả lập bằng cách gửi 5 chunk dữ liệu rỗng (im lặng)
    dummy_pcm_chunk = b'\x00\x00' * 16000 # 1 giây im lặng (16000 samples, mỗi sample 2 bytes)
    dummy_b64 = base64.b64encode(dummy_pcm_chunk).decode("utf-8")
    
    print("[Client -> Gateway] Bắt đầu truyền luồng âm thanh giả lập...")
    for i in range(3):
        audio_msg = {
            "type": "audio_chunk",
            "data": dummy_b64
        }
        await websocket.send(json.dumps(audio_msg))
        print(f"  > Đã gửi audio chunk #{i+1}")
        await asyncio.sleep(0.5)

    # 3. Gửi tín hiệu báo dừng nói (kết thúc luồng giọng nói)
    end_msg = {
        "type": "audio_end"
    }
    await websocket.send(json.dumps(end_msg))
    print("[Client -> Gateway] Đã gửi sự kiện kết thúc âm thanh (audio_end).")

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
