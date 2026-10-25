@echo off
chcp 65001 > nul
echo ===================================================
echo [VKU Field Survey] TỰ ĐỘNG BIÊN DỊCH ANDROID APK
echo ===================================================

:: Thiết lập biến môi trường JDK 21 và Android SDK
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"

echo 1. Build frontend (Vite)...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [LỖI] Build frontend thất bại!
    pause
    exit /b %ERRORLEVEL%
)

echo 2. Sync web assets sang Android...
call npx cap sync android
if %ERRORLEVEL% NEQ 0 (
    echo [LỖI] Capacitor sync thất bại!
    pause
    exit /b %ERRORLEVEL%
)

echo 3. Chạy Gradle assembleRelease...
cd android
call gradlew.bat assembleRelease
if %ERRORLEVEL% NEQ 0 (
    echo [LỖI] Gradle build APK thất bại!
    cd ..
    pause
    exit /b %ERRORLEVEL%
)
cd ..

echo 4. Sao chép APK ra thư mục gốc...
copy /Y "android\app\build\outputs\apk\release\app-release.apk" "VKU_Field_Survey_v1.0.apk" > nul

echo ===================================================
echo [THÀNH CÔNG] File APK đã được tạo tại:
echo - android\app\build\outputs\apk\release\app-release.apk
echo - VKU_Field_Survey_v1.0.apk
echo ===================================================
pause

