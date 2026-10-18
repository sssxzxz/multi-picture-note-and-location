param([string]$SdkPath='C:\Users\49482\AppData\Local\Android\Sdk')
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot
$out=Join-Path $project 'app/build/attachment-test'
$env:JAVA_TOOL_OPTIONS="-Djava.io.tmpdir=$out"
$bt=Join-Path $SdkPath 'build-tools/35.0.0'
$platform=Join-Path $SdkPath 'platforms/android-35/android.jar'
$java=Join-Path $env:JAVA_HOME 'bin'
New-Item -ItemType Directory -Force "$out/classes","$out/dex" | Out-Null
$manifest='<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="cn.zx.photomarker.tests"><uses-sdk android:minSdkVersion="28" android:targetSdkVersion="34"/><application android:label="Attachment tests"/><instrumentation android:name="cn.zx.photomarker.AttachmentTest" android:targetPackage="cn.zx.photomarker"/></manifest>'
Set-Content "$out/AndroidManifest.xml" $manifest -Encoding utf8
function Check {if($LASTEXITCODE -ne 0){throw "Test build failed: $LASTEXITCODE"}}
& "$bt/aapt2.exe" link -o "$out/test.apk" -I $platform --manifest "$out/AndroidManifest.xml"
Check
& "$java/javac.exe" -encoding UTF-8 -source 17 -target 17 -classpath "$platform;$project/app/build/local/classes" -d "$out/classes" "$PSScriptRoot/AttachmentTest.java"
Check
& "$java/jar.exe" cf "$out/classes.jar" -C "$out/classes" .
Check
& "$bt/d8.bat" --lib $platform --classpath "$project/app/build/local/classes.jar" --min-api 28 --output "$out/dex" "$out/classes.jar"
Check
& "$java/jar.exe" uf "$out/test.apk" -C "$out/dex" classes.dex
Check
& "$bt/zipalign.exe" -f 4 "$out/test.apk" "$out/aligned.apk"
Check
& "$bt/apksigner.bat" sign --ks "$project/local-debug.keystore" --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out "$out/attachment-test.apk" "$out/aligned.apk"
Check
Write-Output "$out/attachment-test.apk"
