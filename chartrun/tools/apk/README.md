# 차트런 APK 로 싸기

웹으로 만든 게임을 안드로이드 앱 하나로 싸서 친구한테 보내는 절차다.
게임 쪽은 **이미 오프라인에서 다 돌아간다** — 폰트·앨범 사진·소리가 전부 파일 하나에
박혀 있어서 비행기 모드로도 똑같이 돌아간다. 여기서는 그 파일을 APK 로 감싸기만 한다.

## 미리 있어야 하는 것

| | |
|---|---|
| Node 18+ | 이 저장소를 빌드한다 |
| JDK 17 | Capacitor 가 쓰는 Gradle 이 요구한다 |
| Android Studio | **안드로이드 SDK** 때문에 필요하다 (`ANDROID_HOME` 이 잡혀야 한다) |

## 굽기

```bash
npm run build:apk          # chartrun/tools/apk/www/index.html 이 나온다

cd chartrun/tools/apk
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap add android        # android/ 폴더가 생긴다 (한 번만)
npx cap sync

cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

`capacitor.config.json` 은 이 폴더에 이미 있다 (앱 이름 「차트런」, 배경 `#0a0616`).
아이콘은 `icon.png` (1024×1024) 다 — Android Studio 의 *Image Asset* 으로 넣거나
`android/app/src/main/res/` 에 직접 깐다. 게임 그림이 바뀌면
`node chartrun/tools/apk/make-icon.mjs` 로 다시 구우면 된다 (손으로 안 그린다).

## 손으로 두 줄 고쳐야 하는 것

가로 고정과 전체화면은 Capacitor 설정으로는 안 된다. `npx cap add android` 뒤에
생긴 파일 두 개를 고친다. (`android/` 는 한 번만 만들어지므로 이 수정은 한 번만 하면 된다.)

**`android/app/src/main/AndroidManifest.xml`** — `<activity>` 에 한 줄:

```xml
android:screenOrientation="sensorLandscape"
```

**`android/app/src/main/res/values/styles.xml`** — `AppTheme.NoActionBar` 안에:

```xml
<item name="android:windowFullscreen">true</item>
<item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
```

세로로 들고 켜도 게임이 알아서 화면을 눕혀 주긴 하지만(`body.rotated`),
가로로 고정해두는 편이 훨씬 낫다.

## 친구한테 보낼 때

`app-debug.apk` 를 그대로 보내면 된다 (카톡·드라이브 아무거나).
**받는 쪽에서 한 번은 막힌다** — 같이 적어 보내자:

> 플레이스토어를 안 거친 앱이라 설치할 때 한 번 막힙니다.
> 뜨는 안내에서 **「이 출처 허용」**(설정 → 앱 → 출처를 알 수 없는 앱)을 켜주면 설치됩니다.
> 가로로 들고 하는 게임이고, 인터넷은 필요 없습니다.

`assembleDebug` 로 구운 APK 는 디버그 서명이라 스토어에는 못 올린다.
친구한테 주는 용도로는 그걸로 충분하다.

## 싸기 전에 확인한 것들 (이미 고쳐져 있다)

- **글자** — 구글 폰트를 안 받아온다. 쓰는 글자만 서브셋해서 파일에 박았다
  (`tools/make-fonts.mjs`). 비행기 모드에서도 도트 글자 그대로다
- **뒤로가기** — 누르면 앱이 꺼지는 대신 **일시정지**된다. 멈춘 채로 한 번 더 누르면 나간다
- **화면 잠금** — 컷신을 보고만 있어도 화면이 안 꺼진다 (Wake Lock)
- **저장** — 기기가 저장을 막으면 타이틀에 한 줄 알려준다. 게임은 그대로 돌아간다
- **조작 안내** — 처음 켰을 때 한 번만 타이틀에 뜬다
- **개발자 모드 버튼(⚙)** — `--kiosk` 빌드에서는 안 보인다
