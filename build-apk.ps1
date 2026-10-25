# [VKU Field Survey] PowerShell script build APK tự động không cần mở Android Studio
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host " [VKU Field Survey] TỰ ĐỘNG BIÊN DỊCH ANDROID APK " -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan

# 1. Cấu hình biến môi trường
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

Write-Host "1. Build frontend (Vite)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build frontend thất bại!"
    exit 1
}

Write-Host "2. Đồng bộ Capacitor sang Android..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Error "Capacitor sync thất bại!"
    exit 1
}

Write-Host "3. Biên dịch Gradle CLI (assembleRelease)..." -ForegroundColor Yellow
Set-Location android
.\gradlew.bat assembleRelease
if ($LASTEXITCODE -ne 0) {
    Set-Location ..
    Write-Error "Gradle build APK thất bại!"
    exit 1
}
Set-Location ..

Write-Host "4. Sao chép APK ra thư mục gốc..." -ForegroundColor Yellow
Copy-Item "android\app\build\outputs\apk\release\app-release.apk" "VKU_Field_Survey_v1.0.apk" -Force

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host " [THÀNH CÔNG] File APK đã được tạo tại:" -ForegroundColor Green
Write-Host " - android\app\build\outputs\apk\release\app-release.apk" -ForegroundColor White
Write-Host " - VKU_Field_Survey_v1.0.apk" -ForegroundColor White
Write-Host "===================================================" -ForegroundColor Cyan

