# 비빔랜덤

친구들과 각자 재료를 가져와 비빔밥을 만드는 작은 모임 서비스입니다. React + TypeScript + Vite + Tailwind CSS, Node 기본 HTTP 서버를 사용하며 DB·사용자 로그인·결제는 없습니다.

## 친구들과 사용하는 흐름

1. 랜딩페이지의 **랜덤 비빔밥 시작하기**를 누릅니다.
2. 모임 이름과 내 이름을 입력해 모임을 만듭니다. 만든 사람이 모임장입니다.
3. **초대 링크 복사하기**로 친구들에게 URL을 보냅니다. 친구들은 이름이나 별명만 입력하면 참가합니다.
4. 모두 모이면 모임장이 **미션 배분하기**를 누릅니다. 2~8명에게 서로 다른 미션이 배분되고 신규 참가는 마감됩니다.
5. 각자 자신의 미션을 확인하고 재료를 직접 고릅니다. 서비스는 재료를 정해주지 않습니다.
6. **내가 가져온 재료**에 입력해 제출합니다. 리포트가 완성되기 전까지 다른 사람의 재료와 미션은 비밀입니다.
7. 전원 제출 후 모임장이 **함께 비비고 리포트 만들기**를 누릅니다. 실제 Liner API가 평가·점수·MVP·모험적인 조합을 생성합니다.
8. 같은 링크에서 모두 재료와 리포트를 확인하고, **친구들의 미션 공개 보기**에서 각자의 미션과 재료를 함께 봅니다. 미션 공개 페이지 링크도 복사해 공유할 수 있습니다.

화면은 3초 간격으로 공유 상태를 갱신합니다. 본인 재료만 수정할 수 있고, 미션 배분과 리포트 생성은 모임장만 할 수 있습니다. 리포트 생성 중과 생성 후에는 재료를 변경할 수 없습니다. 미션 공개 페이지는 리포트가 완성된 뒤에만 내용을 보여주며, 모임 링크를 가진 사람은 로그인 없이 볼 수 있습니다.

## 로컬 실행

Node.js **22.18 이상 또는 24 이상**을 사용하세요. 배포 설정은 24.11.0을 사용합니다.

```sh
npm install
```

`.env.local`이 없다면 `.env.example`을 복사해서 만듭니다. 이미 키를 입력한 파일이 있다면 그대로 사용합니다.

```dotenv
LINER_API_KEY=발급받은_키
LINER_MODEL=liner-mark-1.1
```

```sh
npm run dev
```

<http://127.0.0.1:5173>에서 랜딩페이지와 모임 API가 함께 실행됩니다. 같은 컴퓨터의 다른 브라우저에서도 초대 URL로 참가할 수 있습니다. 로컬 주소는 다른 장소의 친구에게 공유할 수 없습니다. 아래 배포 구성을 사용하세요.

기존의 혼자 입력하는 리포트 양식은 로컬 랜딩페이지에서 유지합니다. 배포 랜딩페이지에서는 모임 생성으로 안내합니다.

## GitHub Pages + 작은 API 서버 배포

[GitHub Pages는 정적 화면을 호스팅합니다](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages). 모임 공유와 Liner 호출은 별도 Node 서버에서 처리합니다. Liner 키를 GitHub Pages나 `VITE_` 환경 변수에 넣지 마세요.

### 1. API 서버 배포

저장소를 GitHub에 올린 뒤 [Render](https://render.com)에서 **New → Web Service**로 같은 저장소를 연결합니다. 다음 값을 설정하세요.

| 항목 | 값 |
| --- | --- |
| Runtime | Node |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Instances | 1 |
| `LINER_API_KEY` | 본인의 Liner 키 |
| `LINER_MODEL` | `liner-mark-1.1` |
| `ALLOWED_ORIGINS` | `https://본인아이디.github.io` |

`ALLOWED_ORIGINS`는 **주소의 Origin만** 입력합니다. 저장소 이름 `/bibimbab/` 같은 경로와 마지막 `/`를 붙이지 마세요. 여러 Origin은 쉼표로 구분할 수 있습니다. 커스텀 도메인을 쓰면 그 Origin을 입력합니다.

`render.yaml`도 제공하므로 Render Blueprint를 사용해 같은 설정을 가져올 수 있습니다. 키와 허용 Origin은 직접 입력해야 합니다. 다른 Node 호스팅 서비스에서도 `npm start`와 같은 환경 변수로 실행할 수 있습니다.

API 서버는 `0.0.0.0`과 호스팅 서비스의 `PORT`를 사용합니다. [Render 배포 문서](https://render.com/docs/web-services)

배포 후 API 주소를 확인하세요. 예: `https://bibim-random-api.onrender.com`. API 경로 `/api`를 붙이지 않습니다.

### 2. GitHub Pages 배포

1. 저장소의 **Settings → Pages → Source**에서 **GitHub Actions**를 선택합니다.
2. **Settings → Secrets and variables → Actions → Variables**에서 Repository variable을 추가합니다.
   - 이름: `VITE_API_BASE_URL`
   - 값: 위 API 서버의 HTTPS 주소, 예: `https://bibim-random-api.onrender.com`
3. 코드를 `main`에 push하거나 **Actions → Deploy frontend to GitHub Pages → Run workflow**를 실행합니다. 기본 브랜치가 다르면 `.github/workflows/pages.yml`의 브랜치도 변경합니다.
4. GitHub Pages에서 받은 주소로 모임을 만들고 그 화면의 초대 링크를 공유합니다.

워크플로는 공개 API 주소만 빌드에 넣으며 Liner 키를 사용하지 않습니다. API 주소를 설정하지 않으면 배포 빌드를 중단합니다. Pages 설정에서 얻은 경로를 Vite `base`에 사용하므로 저장소 이름이 바뀌어도 적용됩니다. [Vite의 Pages 배포 안내](https://vite.dev/guide/static-deploy.html#github-pages)

초대 주소는 `https://본인아이디.github.io/저장소명/#/room/모임ID` 형식입니다. GitHub Pages에서 해시 뒤 경로를 요청하지 않으므로 초대 링크를 직접 열거나 새로고침해도 정적 페이지가 열립니다.

## 모임 데이터의 수명

- DB 대신 **API 서버 메모리**에 저장합니다. 최대 100개 모임, 모임당 8명, 생성 후 24시간입니다.
- **서버 재시작·재배포·절전 시 모든 모임과 리포트가 사라집니다.** 잃어버린 모임은 새로 만들어야 합니다.
- Render Free는 15분 동안 요청이 없으면 절전하며 재접속 시 시작에 시간이 걸릴 수 있습니다. 모임을 진행할 때 페이지를 열어두세요. 호스팅 비용과 사용 한도는 [Render Free 문서](https://render.com/docs/free)를 확인하세요.
- 서버는 반드시 한 인스턴스로 사용하세요. 메모리를 여러 서버 간 공유하지 않습니다.
- 참가 토큰은 본인의 브라우저에 저장합니다. 같은 브라우저에서 링크를 다시 열면 돌아올 수 있습니다. 브라우저 저장소를 지우거나 다른 기기로 바꾸면 본인·모임장 권한을 복구할 수 없습니다. 브라우저가 저장을 막으면 현재 탭에서만 참가할 수 있습니다.
- 링크를 가진 사람은 대기 중에 참가하거나 완성된 리포트를 볼 수 있습니다. 친구들에게만 공유하는 작은 모임을 위한 구성입니다.

## API 비용

- 미션 배분과 참가, 상태 갱신, 재료 입력에는 Liner 호출이 없습니다.
- 전원 재료를 제출한 뒤 모임장의 리포트 생성 버튼을 눌러야 호출합니다.
- 모임당 성공한 리포트는 한 번만 생성하고 모두에게 공유합니다. 서버 캐시도 적용합니다. 실패 후 수동 재시도에는 비용이 발생할 수 있습니다.
- 추론 끄기, 출력 600토큰 제한, 자동 재시도 없음, 동시 AI 호출 제한과 5초 호출 간격을 적용합니다.
- AI에는 참가자 이름과 재료만 전송합니다. 요청은 `store: false`이며 평가는 재료명을 바탕으로 상상한 놀이용 평가입니다.
- 브이로그는 Coming Soon과 촬영 가이드만 제공합니다. 영상 업로드·편집·영상 API 호출은 없습니다.

[Liner Chat Completions 문서](https://liner.com/ko/developers/docs/liner-model-api-chat-completions) · [Liner 요금표](https://liner.com/ko/developers/docs/pricing)

## 명령어와 파일

| 명령어 | 용도 |
| --- | --- |
| `npm run dev` | 로컬 화면 + 메모리 API 함께 실행 |
| `npm start` | 배포용 독립 API 서버, 기본 포트 8787 |
| `npm run build` | 프론트엔드 및 서버 TypeScript 확인 + 정적 화면 빌드 |
| `npm run preview` | 로컬 빌드 미리보기 + 메모리 API |

독립 API 서버와 로컬 화면을 연결하려면 `.env.local`에 `VITE_API_BASE_URL=http://127.0.0.1:8787`, `ALLOWED_ORIGINS=http://127.0.0.1:5173`을 설정합니다. 환경 변수 변경 후 서버를 다시 시작하세요. Vite 내장 API와 독립 서버는 각자 다른 메모리를 사용합니다.

- `src/Gathering.tsx`: 생성·초대·참가·미션·재료·리포트 화면
- `src/api.ts`: API 호출과 브라우저 참가 정보
- `src/missions.ts`: 화면과 서버가 공유하는 미션 목록
- `server/api.ts`: 메모리 모임과 참가자 권한·상태 처리
- `server/liner.ts`: 실제 Liner 리포트 생성
- `server/index.ts`: 독립 Node API 서버
- `.github/workflows/pages.yml`: GitHub Pages 배포
- `render.yaml`: API 서버 배포 예시
