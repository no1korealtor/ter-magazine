# 📰 소식지 터 - 독자용 매거진 (ter-magazine) 작업 규칙

## 🚨 0. 최우선 시스템 안정성 규칙 (서버 재시작 / 깜빡임 원천 방지)
- 이 PC의 D드라이브는 NTFS가 아닌 파일시스템(exFAT 등) 및 한글 경로 특성으로 인해, `run_command` 도구를 `BypassSandbox: false`(기본 샌드박스 모드)로 호출하면 Windows 보안 샌드박스가 충돌하여 내부 서버가 즉시 재시작(`server restart` / 화면 깜빡임)됩니다.
- **절대 파일 조회나 텍스트 수정 용도로 `run_command`(`powershell`, `python`, `Get-ChildItem`, `git` 등)를 호출하지 마세요!**
- 파일 읽기는 반드시 **`read_file`**, 파일 수정은 반드시 **`edit_file`** (또는 **`write_file`**) 도구만 사용하세요. (`read_file`과 `edit_file`은 샌드박스를 거치지 않아 100% 안전하게 작동합니다.)
- 만약 `edit_file`이 줄바꿈/공백 차이로 실패하더라도 절대 터미널 명령어(`run_command`)로 우회하지 말고, `read_file`로 해당 줄을 다시 정확히 읽은 뒤 `edit_file`로 수정하세요.
- 배포 등을 위해 부득이하게 `run_command`를 실행해야 할 때는 첫 시도부터 반드시 **`BypassSandbox: true`** 로 설정하여 호출하세요.


이 폴더(`D:\부동산업무\antigravity\ter-magazine`)는 **부동산 소식지 '터(TER)' 매거진 뷰어** 전용 작업 공간입니다.

## 1. 핵심 파일 및 안드로이드 연동 구조
- **`index.html`:** 매거진 메인 레이아웃 및 기사 열람 모달 구조
- **`app.js`:** 기사 렌더링, 카카오톡 공유, 글자 크기 조절, 스크랩 등 핵심 로직
- **`style.css`:** 매거진 스타일시트
- **안드로이드 앱 동기화 필수:**
  - `index.html`, `app.js`, `style.css`를 수정한 경우 반드시 `D:\부동산업무\antigravity\test_ter_android\app\src\main\assets\` 폴더에도 동일하게 복사해 동기화하세요.

## 2. AI 에이전트 필수 주의사항
- 폴더 내부에 일회용 파이썬 패치 스크립트(`add_*.py`, `fix_*.py`)를 남겨두지 마세요.
- 캐시 갱신이 필요한 경우 `index.html`의 `app.js?v=...` 및 `style.css?v=...` 버전 파라미터를 함께 업데이트하세요.
