FROM python:3.12-slim

# Prevent python from writing pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose port (Cloud Run will override this with its own PORT env var)
EXPOSE 8000

# Command to run the application, dynamically binding to $PORT (defaults to 8000)
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
