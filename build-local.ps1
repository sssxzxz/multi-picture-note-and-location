param([string]$SdkPath = "$env:LOCALAPPDATA\Android\Sdk")
$ErrorActionPreference = 'Stop'
$project = $PSScriptRoot
$out = Join-Path $project 'app\build\local'
$tools = Join-Path $SdkPath 'build-tools\35.0.0'
$platform = Join-Path $SdkPath 'platforms\android-35\android.jar'
$java = Join-Path $env:JAVA_HOME 'bin'
New-Item -ItemType Directory -Force "$out\classes", "$out\dex" | Out-Null
$env:JAVA_TOOL_OPTIONS = "-Djava.io.tmpdir=$out"
function Check { if ($LASTEXITCODE -ne 0) { throw "构建失败，退出码 $LASTEXITCODE" } }
$manifest = (Get-Content "$project\app\src\main\AndroidManifest.xml" -Raw).Replace('<manifest ', '<manifest package="cn.zx.photomarker" ')
Set-Content "$out\AndroidManifest.xml" $manifest -Encoding utf8
& "$tools\aapt2.exe" link -o "$out\unsigned.apk" -I $platform --manifest "$out\AndroidManifest.xml" -A "$project\app\src\main\assets" --min-sdk-version 28 --target-sdk-version 34 --version-code 17 --version-name '0.1.16'
Check
& "$java\javac.exe" -encoding UTF-8 -source 17 -target 17 -classpath $platform -d "$out\classes" "$project\app\src\main\java\cn\zx\photomarker\MainActivity.java" "$project\app\src\main\java\cn\zx\photomarker\PriceWorkbook.java"
Check
& "$java\jar.exe" cf "$out\classes.jar" -C "$out\classes" .
Check
& "$tools\d8.bat" --lib $platform --min-api 28 --output "$out\dex" "$out\classes.jar"
Check
& "$java\jar.exe" uf "$out\unsigned.apk" -C "$out\dex" classes.dex
Check
& "$tools\zipalign.exe" -f 4 "$out\unsigned.apk" "$out\aligned.apk"
Check
$key = Join-Path $project 'local-debug.keystore'
if (!(Test-Path $key)) {
 & "$java\keytool.exe" -genkeypair -keystore $key -storepass android -keypass android -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=Photo Marker Debug'
 Check
}
& "$tools\apksigner.bat" sign --ks $key --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out "$out\photo-marker-0.1.16.apk" "$out\aligned.apk"
Check
& "$tools\apksigner.bat" verify --verbose "$out\photo-marker-0.1.16.apk"
Check
Write-Output "$out\photo-marker-0.1.16.apk"
