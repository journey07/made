# 🔄 Sync 시스템 작동 원리

## 핵심 개념: "로그인 없는 클라우드 동기화"

브라우저 localStorage는 캐시 삭제 시 날아가므로, **Supabase DB에 자동 저장**하되 **로그인은 필요 없게** 만든 시스템입니다.

---

## 1. 복구 코드(Recovery Code)란?

### 생성 시점
- 앱을 **처음 열 때** 자동 생성
- 예: `5YKUG23H` (8자리, 대문자+숫자)

### 역할
복구 코드는 **"당신의 데이터를 식별하는 비밀 키"** 입니다:
- **저장 시**: 이 코드로 DB에서 당신의 행(row)을 찾아서 업데이트
- **로드 시**: 이 코드로 DB에서 당신의 데이터를 가져옴
- **복원 시**: 브라우저 캐시가 삭제돼도 이 코드만 있으면 데이터 복구

### 보관 방법
1. **자동 보관**: `localStorage`에 저장 (`mades-recovery-code`)
2. **수동 백업**: 상단 Sync 버튼 클릭 → 코드 복사해서 메모장/비밀번호 관리자에 저장

---

## 2. 동기화 플로우 (단계별)

### 🚀 **Step 1: 앱 시작 (초기화)**

```
사용자 앱 접속
    ↓
localStorage에 복구 코드 있나?
    ↓
    ├─ YES → 그 코드로 DB에서 데이터 로드
    │         (GET /planner_data?recovery_code=eq.5YKUG23H)
    │         ↓
    │         데이터 있음? → 로드 완료 (Synced)
    │         데이터 없음? → 현재 로컬 상태를 DB에 저장 (POST)
    │
    └─ NO  → 새 복구 코드 생성 (예: 5YKUG23H)
              ↓
              localStorage에 저장
              ↓
              현재 로컬 상태를 DB에 저장 (POST)
```

### ✏️ **Step 2: 작업 추가/수정 (자동 저장)**

```
사용자가 작업 추가/완료/수정
    ↓
React State 업데이트 (tasks, config)
    ↓
localStorage에 저장 (fallback)
    ↓
⏱️ 0.8초 디바운스 대기
    ↓
Supabase에 자동 저장
    (POST /planner_data?on_conflict=recovery_code)
    ↓
상태 표시: Saving... → Synced ✅
```

**디바운스란?**  
사용자가 연속으로 슬라이더를 조작하면, 매번 DB에 저장하지 않고 **마지막 변경 후 0.8초 뒤에 1번만 저장**합니다. (성능 최적화)

### 🔄 **Step 3: 브라우저 캐시 삭제 후 복원**

```
사용자가 브라우저 캐시 삭제
    ↓
localStorage 날아감 (복구 코드 포함)
    ↓
앱 다시 접속 → 복구 코드 없음 → 새 코드 생성됨 (데이터 없는 상태)
    ↓
상단 Sync 버튼 클릭
    ↓
복구 모달 열림 → "복구 코드로 데이터 복원" 입력
    ↓
기존 코드 입력 (예: 5YKUG23H)
    ↓
Supabase에서 해당 코드의 데이터 로드
    (GET /planner_data?recovery_code=eq.5YKUG23H)
    ↓
데이터 복원 완료! ✅
```

---

## 3. DB 구조 (Supabase)

### 테이블: `planner_data`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `recovery_code` | text (PK) | 복구 코드 (8자리) |
| `tasks` | jsonb | 모든 작업 배열 `[{id, title, m, a, d, e, ...}, ...]` |
| `config` | jsonb | 설정 객체 `{weights: {...}, criteria: {...}, defaultValues: {...}}` |
| `updated_at` | timestamptz | 마지막 저장 시간 (자동 갱신) |

### 예시 데이터

```json
{
  "recovery_code": "5YKUG23H",
  "tasks": [
    {
      "id": "lkj3h2kj",
      "title": "Supabase 연동 완료",
      "m": 8,
      "a": 7,
      "d": 1.5,
      "e": 3,
      "score": 19.5,
      "completed": false,
      "createdAt": 1704556800000
    }
  ],
  "config": {
    "weights": {"m": 0.8, "a": 1.2},
    "criteria": {...},
    "defaultValues": {"m": 5, "a": 4, "d": 1.5, "e": 3}
  },
  "updated_at": "2026-01-06T12:34:56Z"
}
```

### Row Level Security (RLS)

```sql
-- 누구나(anon) 모든 행에 접근 가능
create policy "anon_full_access"
on planner_data
for all
to anon
using (true)
with check (true);
```

**왜 이렇게 열어두나요?**  
- 복구 코드를 **아는 사람만** 데이터에 접근 가능
- 복구 코드는 8자리 랜덤 (약 2조 8천억 가지 조합)
- URL에 노출되지 않고 localStorage에만 저장
- 로그인 없이도 개인 데이터를 안전하게 유지

---

## 4. 보안 모델

### ✅ 안전한 이유

1. **복구 코드는 클라이언트에만 존재**  
   - 서버는 모르고, localStorage + 사용자가 복사한 곳에만 있음
   - 코드 없이는 데이터 접근 불가

2. **8자리 랜덤 → 추측 불가**  
   - 조합 수: `32^8 = 1,099,511,627,776` (약 1조)
   - 무작위 대입 공격(Brute Force) 사실상 불가능

3. **URL에 노출 안 됨**  
   - 기존 v1은 URL 해시에 sync key 포함 → 공유 시 위험
   - v2는 localStorage에만 저장 → 브라우저 밖으로 안 나감

### ⚠️ 주의사항

1. **복구 코드를 잃어버리면?**  
   → 데이터 복구 불가 (DB에는 있지만 찾을 방법이 없음)

2. **복구 코드가 노출되면?**  
   → 타인이 당신의 데이터를 읽고 수정 가능  
   → **해결책**: 새 복구 코드 생성 (기존 데이터는 버림)

3. **여러 기기에서 사용하려면?**  
   → 각 기기에서 복구 코드 수동 입력 필요  
   → 같은 코드 쓰면 동일 데이터 공유 (마지막 저장이 이김)

---

## 5. Sync 상태 표시 (UI)

| 상태 | 아이콘 | 의미 |
|------|--------|------|
| **Synced** | ☁️ (초록) | DB 저장 완료 |
| **Saving...** | 🔄 (주황, 회전) | DB에 저장 중 |
| **Loading...** | 🔄 (파랑, 회전) | DB에서 로드 중 |
| **Error** | ☁️❌ (빨강) | 저장/로드 실패 |
| **Offline** | ☁️ (회색) | Supabase 미설정 |

---

## 6. 실제 네트워크 호출 예시

### 초기 로드 (복구 코드 있을 때)

```http
GET https://[project].supabase.co/rest/v1/planner_data?select=tasks,config&recovery_code=eq.5YKUG23H
Authorization: Bearer [anon_key]
```

**응답 (데이터 있음)**:
```json
[
  {
    "tasks": [...],
    "config": {...}
  }
]
```

**응답 (데이터 없음)**:
```json
[]
```

### 초기 저장 (새 복구 코드)

```http
POST https://[project].supabase.co/rest/v1/planner_data
Authorization: Bearer [anon_key]
Content-Type: application/json

{
  "recovery_code": "5YKUG23H",
  "tasks": [],
  "config": {...}
}
```

### 자동 저장 (기존 코드, Upsert)

```http
POST https://[project].supabase.co/rest/v1/planner_data?on_conflict=recovery_code
Authorization: Bearer [anon_key]
Content-Type: application/json
Prefer: resolution=merge-duplicates

{
  "recovery_code": "5YKUG23H",
  "tasks": [{...}, {...}],
  "config": {...}
}
```

---

## 7. 코드 핵심 로직 (요약)

### App.tsx - 초기화

```typescript
useEffect(() => {
  // 1. 복구 코드 확인
  let code = localStorage.getItem('mades-recovery-code');
  
  // 2. 없으면 생성
  if (!code) {
    code = generateRecoveryCode(); // 8자리 랜덤
    localStorage.setItem('mades-recovery-code', code);
  }

  // 3. DB에서 로드
  const { data } = await supabase
    .from('planner_data')
    .select('tasks, config')
    .eq('recovery_code', code)
    .maybeSingle();

  // 4. 데이터 처리
  if (data) {
    setTasks(data.tasks);  // DB에서 로드
    setConfig(data.config);
  } else {
    // 첫 방문 → 현재 상태를 DB에 저장
    await supabase.from('planner_data').insert({
      recovery_code: code,
      tasks: currentTasks,
      config: currentConfig
    });
  }
}, []);
```

### App.tsx - 자동 저장

```typescript
useEffect(() => {
  // 0.8초 디바운스
  const handle = setTimeout(async () => {
    await supabase.from('planner_data').upsert({
      recovery_code: recoveryCode,
      tasks,
      config
    }, { onConflict: 'recovery_code' });
  }, 800);

  return () => clearTimeout(handle);
}, [tasks, config]);
```

---

## 8. 장단점 비교

### ✅ 장점

1. **로그인 불필요** - 이메일/비밀번호 없이 바로 사용
2. **자동 동기화** - 버튼 안 눌러도 알아서 저장
3. **캐시 삭제 대응** - 복구 코드만 있으면 복원
4. **단순한 DB** - 테이블 1개, 컬럼 4개로 끝
5. **빠른 속도** - 직접 CRUD (RPC 없음)

### ⚠️ 단점

1. **복구 코드 분실 위험** - 잃어버리면 복구 불가
2. **멀티 디바이스 번거로움** - 수동으로 코드 입력 필요
3. **충돌 해결 없음** - 여러 기기에서 동시 수정 시 마지막 저장이 이김
4. **보안 = 복구 코드** - 코드 노출 = 데이터 노출

---

## 9. FAQ

### Q1. 복구 코드를 잃어버렸어요!
**A**: 안타깝게도 복구 불가능합니다. 새로운 앱 세션으로 시작하셔야 합니다.  
→ **예방**: 상단 Sync 버튼 눌러서 코드를 복사해두세요.

### Q2. 여러 기기에서 쓰고 싶어요.
**A**: 각 기기에서:
1. 상단 Sync 버튼 클릭
2. "복구 코드로 데이터 복원" → 기존 코드 입력
3. 복원 버튼 클릭

### Q3. 두 기기에서 동시에 수정하면?
**A**: 마지막에 저장한 쪽이 이깁니다. (충돌 해결 없음)  
→ **권장**: 한 번에 한 기기에서만 사용

### Q4. 복구 코드를 바꿀 수 있나요?
**A**: 현재는 자동 생성만 지원합니다.  
→ **해결책**: localStorage 삭제 → 새로고침 → 새 코드 생성

### Q5. Supabase 설정 안 하면?
**A**: localStorage만 사용합니다 (캐시 삭제 시 데이터 손실).  
상단에 "Offline" 표시됩니다.

---

## 10. 개발자용: 디버깅

### localStorage 확인 (브라우저 콘솔)

```javascript
// 현재 복구 코드
localStorage.getItem('mades-recovery-code')

// 현재 로컬 tasks
JSON.parse(localStorage.getItem('mades-planner-tasks'))

// 초기화 (주의: 데이터 삭제)
localStorage.clear()
```

### Supabase DB 직접 조회

```sql
-- 모든 복구 코드 목록
SELECT recovery_code, updated_at FROM planner_data;

-- 특정 코드의 데이터
SELECT * FROM planner_data WHERE recovery_code = '5YKUG23H';

-- 최근 업데이트된 순서
SELECT recovery_code, updated_at 
FROM planner_data 
ORDER BY updated_at DESC 
LIMIT 10;
```

---

## 결론

**"로그인 없는 클라우드 동기화"** = 복구 코드를 "비밀 키"로 사용해서, 번거로운 계정 생성 없이도 데이터를 안전하게 클라우드에 저장하는 시스템입니다.

**핵심**: 복구 코드를 안전한 곳에 백업하세요! 🔑

