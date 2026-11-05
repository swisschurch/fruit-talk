# Fruit Consultation (열매 의논 신청)

화면은 모두 **영어**예요. 이 안내서만 한국어로 썼고, 버튼 이름은 화면에 나오는 영어 그대로 적었어요.

성전에 붙인 QR로 성도가 열매 의논을 신청하고, 관리자가 일정을 잡고, 구역 담당자가 피드백과 후속 확인을 기록하는 웹페이지예요.
열매 바구니 게임과 같은 방식(GitHub Pages + Firebase)으로 돌아가요.

## 화면 4개

| 주소 | 누가 | 하는 일 |
|---|---|---|
| `https://내아이디.github.io/fruit-talk/` | 성도 (QR) | 로그인 없이 4단계로 신청 |
| 주소 끝에 `#admin` | 관리자 | 신청 확인, 상태·일정·담당자 지정, 부서·담당자 관리, QR 포스터 인쇄 |
| 주소 끝에 `#leader` | 구역 담당자 | 내게 배정된 신청만 보고 피드백·후속 확인 기록 |
| 주소 끝에 `#poster` | 누구나 | A4 인쇄용 QR 포스터 |

**진행 상태:** Received(접수) → Scheduling(일정 조율 중) → Scheduled(의논 확정) → Consulted(의논 완료) → Following up(후속 확인 중) → Closed(종결)
추가 의논이 필요하면 성도가 같은 QR로 **Follow-up request**(재신청)를 하고, 이름과 열매 호칭이 같으면 이전 의논 기록이 자동으로 함께 보여요.

---

## 0단계. 먼저 데모로 둘러보기

zip을 풀고 GitHub에 올리기만 해도(5단계) **데모 모드**로 열려요. 예시 신청 6건이 들어 있고, 이 브라우저에만 저장돼요.
- `#admin` 은 로그인 없이 열리고, `#leader` 는 위쪽 **Example leader** 에서 예시 담당자를 바꿔 볼 수 있어요.
- 실제 운영 전에는 꼭 1~4단계로 Firebase를 연결하세요.

## 1단계. Firebase 프로젝트

열매 바구니 게임에서 쓰던 Firebase 프로젝트를 **그대로 써도 되고**, 새로 만들어도 돼요.
같은 프로젝트를 쓰면 1·3단계는 건너뛰고, 2단계 규칙만 **합쳐서** 붙여야 해요 (맨 아래 "게임과 같은 프로젝트를 쓸 때" 참고).

새로 만들 때:
1. **console.firebase.google.com** → **프로젝트 추가** → 이름 `fruit-talk` → 애널리틱스는 꺼도 돼요.
2. 왼쪽 **빌드 → Firestore Database → 데이터베이스 만들기** → 위치 `europe-west6 (Zürich)` → **프로덕션 모드**
3. 왼쪽 **빌드 → Authentication → 시작하기** → 로그인 방법에서 **Google** 사용 설정 → 저장

## 2단계. 보안 규칙 붙이기 (자물쇠)

1. **Firestore Database → 규칙(Rules)** 탭을 눌러요.
2. 안에 있는 글을 전부 지우고 `firestore.rules` 파일 내용을 통째로 붙여 넣어요.
3. `YOUR_EMAIL@gmail.com` 을 **관리자 구글 이메일**로 바꿔요. 여러 명이면 `['a@gmail.com', 'b@gmail.com']` 처럼 써요. **소문자**로 쓰세요.
4. **게시(Publish)** 를 눌러요.

이 규칙 덕분에:
- 성도는 신청을 **쓰기만** 하고, 다른 사람 신청은 하나도 볼 수 없어요.
- 담당자는 **자기에게 배정된 신청만** 보고, 피드백·후속 확인·상태만 바꿀 수 있어요.
- 관리자만 전체를 보고, 부서·담당자 표를 바꿀 수 있어요.

## 3단계. 웹 앱 등록 → config.js

1. 프로젝트 설정(톱니바퀴) → **일반** → 아래 "내 앱"에서 **`</>` (웹)** 버튼
2. 앱 이름 `fruit-talk`, "Firebase 호스팅"은 체크하지 마세요 → **앱 등록**
3. 나오는 `firebaseConfig` 에서 `{` 부터 `}` 까지 복사
4. `config.js` 를 메모장으로 열고 `firebase: null,` 에서 **`null` 만 지우고** 붙여 넣기 (끝의 쉼표 `,` 는 남겨 두세요)
5. 같은 파일에서 `churchName`(기본값 `Swiss Church`)도 원하는 이름으로 바꿔요. 요일·시간대·관계 선택지도 여기서 바꿀 수 있어요.

## 4단계. 승인된 도메인

이걸 안 하면 관리자·담당자 구글 로그인이 막혀요.
**Authentication → 설정 → 승인된 도메인 → 도메인 추가** → `내아이디.github.io` (앞의 `https://`, 뒤의 폴더 이름 없이)

## 5단계. GitHub Pages에 올리기

1. github.com → 오른쪽 위 **+ → New repository** → 이름 `fruit-talk`, **Public** → Create
2. **uploading an existing file** → zip을 푼 폴더 **안의 것들**을 끌어다 놓기
   - `index.html`, `app.js`, `config.js`, `firestore.rules`, `README.md`, `assets` 폴더
   - `index.html` 이 맨 바깥에 있어야 해요.
3. **Commit changes**
4. **Settings → Pages** → Branch `main`, `/(root)` → Save
5. 1~2분 뒤 `https://내아이디.github.io/fruit-talk/` 로 열려요.

## 6단계. 처음 설정

1. `…/fruit-talk/#admin` → 관리자 구글 계정으로 로그인
2. **Groups & leaders** 탭 → 부서, 구역, 구역별 담당자 이름과 **구글 이메일** 입력 → **저장**
   - 저장하면 신청 화면의 부서·구역 목록이 바뀌고, 그 이메일로 담당자 로그인이 열려요.
3. **QR poster** 탭 → **Open for printing** → **Print** (A4, 여백 없음) → 성전에 붙이기
4. 휴대폰으로 QR을 찍어 시험 신청을 한 건 넣고, 관리자 화면에 뜨는지 확인 → 확인 후 삭제

## 운영 흐름

1. **성도**: QR → 신청 종류, Department·Group·이름 → 열매(이니셜·별칭), 관계, 연결 경로 → 진행 상황, 어려운 점 → 가능 시간 → **Send request**
2. **관리자**: Received(빨간 숫자) 확인 → 가능 시간을 보고 성도에게 연락 → **Scheduling** → 일시·장소를 넣고 **Scheduled** → **Save**
   - 담당자 칸에는 그 구역 담당자가 미리 골라져 있어요. **저장하는 순간** 담당자 화면에 이 신청이 나타나요.
3. **담당자**: 의논에 함께 참여 → 담당자 화면에서 피드백 기록 → 이후 확인할 때마다 **+ Add check** → 다 끝나면 **Closed** → **Save record**
4. 추가 의논이 필요하면 성도에게 QR로 **Follow-up request** 를 하라고 안내 → 관리자·담당자 화면에 이전 기록이 함께 보여요.

## 개인정보

- 신청 화면에서 열매 이름은 **이니셜이나 별칭**(예: L.M., Colleague A)으로 적도록 안내해요.
- 성도는 자기 신청도 다시 볼 수 없어요. 휴대폰에는 다음 신청을 위해 이름·부서·구역만 기억해요.
- 관리자 메모는 담당자도 볼 수 있어요.
- 종결된 건은 관리자 화면에서 **Download CSV**로 보관한 뒤 **삭제**하는 것을 권장해요.

## 막혔을 때

- **오른쪽 위에 "Demo mode"가 떠요** → `config.js` 의 `firebase` 가 아직 `null` 이거나 쉼표·따옴표가 빠졌어요.
- **"this account isn't a coordinator"** → 2단계 3번 이메일이 로그인한 계정과 똑같은지(소문자) 확인하고 다시 **게시**
- **"this account isn't registered as a leader"** → 관리자 화면 Groups & leaders 탭에 그 이메일이 정확히 들어가 있고 **저장**했는지 확인
- **로그인 창이 안 뜨거나 unauthorized domain** → 4단계 확인
- **담당자 화면에 신청이 안 보여요** → 관리자가 그 신청에서 담당자를 고르고 **저장**했는지 확인
- **GitHub에서 고친 게 안 보여요** → 1~2분 기다린 뒤 새로고침

## 게임과 같은 프로젝트를 쓸 때

Firestore 규칙은 프로젝트에 하나뿐이라, 게임 규칙을 지우면 게임이 멈춰요.
게임 규칙의 `match /databases/{database}/documents { … }` 안쪽 맨 끝에, 이 파일의 `function signedIn()` 부터 마지막 `match /requests/{id} { … }` 까지를 **이어 붙이세요**.
함수 이름이 겹치면(예: `isAdmin`) 이쪽 이름을 `ftAdmin` 처럼 바꿔 주세요. 어렵다면 규칙 두 개를 보내 주시면 합쳐 드릴게요.
