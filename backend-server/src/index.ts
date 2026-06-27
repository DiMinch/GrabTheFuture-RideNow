// src/index.ts
import { onRequest } from "firebase-functions/v2/https";
import app from "./server.js";
import "./config/firebase.js";

// Export hàm 'api' để Firebase nhận diện đây là Cloud Function
// Cấu hình region asia-southeast1 (Singapore) để tối ưu độ trễ cho người dùng tại Việt Nam
export const api = onRequest(
  { 
    cors: true,
    region: "asia-southeast1",
  }, 
  app
);