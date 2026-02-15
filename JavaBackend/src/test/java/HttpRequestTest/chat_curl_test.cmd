@echo off
setlocal

echo [INFO] Sending request to Java endpoint...
curl -X POST "http://127.0.0.1:8080/api/v1/chat/completions" ^
  -H "Content-Type: application/json" ^
  -d "{\"user_input\":\"hello from curl\",\"model\":\"gemini-3-flash-preview\"}"

echo.
echo [INFO] Done.
endlocal
