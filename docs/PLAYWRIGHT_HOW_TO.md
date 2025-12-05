# Playwright를 이용한 E2E 테스트 시작하기

Playwright는 웹 애플리케이션의 엔드-투-엔드(E2E) 테스트 자동화를 위한 강력한 도구입니다. 이 문서는 `agent-chat-ui` 프로젝트에서 Playwright를 설정하고 사용하는 기본적인 방법을 안내합니다.

## 1. Playwright 설정

Playwright는 이미 프로젝트에 설치되어 있습니다. 다음 단계를 통해 필요한 구성 요소들이 준비되었는지 확인합니다.

### 1.1 Playwright 설치 및 브라우저 바이너리 다운로드

Playwright와 필요한 브라우저 바이너리(Chromium, Firefox, WebKit)는 이미 설치되었습니다. 만약 다시 설치해야 한다면, 다음 명령어를 사용하세요:

```bash
pnpm add -D @playwright/test
pnpm exec playwright install
```

### 1.2 Playwright 설정 파일 (`playwright.config.ts`)

프로젝트 루트에 `playwright.config.ts` 파일이 이미 생성되어 있습니다. 이 파일은 테스트 실행 방식과 환경을 정의합니다. 특히, `webServer` 섹션은 테스트를 시작하기 전에 Next.js 개발 서버(`pnpm dev`)를 자동으로 실행하도록 설정되어 있습니다.

```typescript
// playwright.config.ts (부분 발췌)
webServer: {
  command: 'pnpm dev',
  url: 'http://localhost:3000',
  reuseExistingServer: !process.env.CI,
  stdout: 'pipe',
  timeout: 60 * 1000,
},
```

### 1.3 예제 테스트 파일 (`tests/example.spec.ts`)

`tests/` 디렉터리 안에 `example.spec.ts`라는 예제 테스트 파일이 생성되어 있습니다. 이 파일은 Playwright 테스트의 기본 구조와 페이지 탐색, 요소 검증 방법을 보여줍니다.

## 2. 테스트 실행 방법

모든 Playwright 테스트를 실행하려면 다음 명령어를 터미널에서 실행하세요:

```bash
pnpm exec playwright test
```

이 명령어는 `playwright.config.ts`에 정의된 `webServer` 설정을 기반으로 Next.js 개발 서버를 자동으로 시작하고, 모든 브라우저(기본적으로 Chromium, Firefox, WebKit)에서 테스트를 순차적으로 실행합니다.

## 3. 테스트 리포트 확인

테스트 실행이 완료되면, 그 결과에 대한 상세한 HTML 리포트를 다음 명령어를 통해 확인할 수 있습니다:

```bash
pnpm exec playwright show-report
```

이 명령은 웹 브라우저에서 인터랙티브한 HTML 리포트를 열어줍니다. 리포트에서는 각 테스트의 성공/실패 여부, 실행 시간, 로그, 그리고 실패한 테스트의 경우 스크린샷과 비디오까지 확인할 수 있어 문제 진단에 매우 유용합니다.

## 4. 다음 단계

*   **새로운 테스트 작성**: `tests/` 디렉터리 안에 새로운 `.spec.ts` 파일을 생성하여 애플리케이션의 특정 기능에 대한 테스트 시나리오를 작성하세요.
*   **API 테스트**: Playwright는 E2E 테스트뿐만 아니라 API 테스트에도 활용될 수 있습니다. `request` 컨텍스트를 사용하여 백엔드 API를 직접 테스트해 보세요.
*   **CI/CD 통합**: 지속적 통합/지속적 배포(CI/CD) 파이프라인에 Playwright 테스트를 통합하여 코드 변경 시마다 자동으로 테스트가 실행되도록 설정할 수 있습니다.
*   **환경 변수 관리**: `PLAYWRIGHT_TEST_BASE_URL`과 같은 환경 변수를 사용하여 테스트 환경을 유연하게 관리할 수 있습니다.
