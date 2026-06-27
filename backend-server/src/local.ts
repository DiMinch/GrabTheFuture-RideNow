import app from './server.js';
import dotenv from 'dotenv';

dotenv.config();

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`[RideNow] Local server running at http://localhost:${port}`);
  console.log(`[RideNow] Swagger UI available at http://localhost:${port}/docs`);
});
