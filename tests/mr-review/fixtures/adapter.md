# 테스트 어댑터 (가상 프로젝트)

> 테스트 전용. 실제 프로젝트 이름·주소·사람 이름을 넣지 않는다.

## 1. 저장소

| 이름 | ID | 경로 |
|---|---|---|
| alpha | 101 | `repos/alpha` |
| beta | 102 | `repos/beta` |
| docs | 103 | `docs` |

## 2. 정책·항상 읽는 절

- `guide/policy.md` — 판정 기준 `TEST-POLICY-v1.1`. 전환기: 계약은 `v1.0`도 허용.

## 3. 렌즈

| ID | 질문 | 발견 유형 |
|---|---|---|
| L1 사유 | 배경에 왜·무엇을이 있는가 | MISSING_EVIDENCE |
| L5 보안 | 하드코딩 비밀·로그 개인정보 | DEFECT(항상 차단) |

## 4. 문서 지도

(기계 블록 참조)

## 5. 위키

(기계 블록 참조)

## 6. 외부 전송 허용 목록

허용: 워크트리 전체 · diff · MR 본문·댓글 · 공통 문서 발췌 · 팀 위키 발췌 · 이 문서. 금지: 개인 위키.

## 7. 운영 배포 대상

(기계 블록 참조)

## 7a. 댓글 형식

(기계 블록 참조)

## 8. 리포트

(기계 블록 참조)

## 기계 블록

```json mr-review-adapter
{
  "schema": 1,
  "workspaceRoot": "..",
  "docsRoot": "docs",
  "projects": {
    "alpha": { "id": 101, "path": "repos/alpha", "deployExempt": false },
    "beta": { "id": 102, "path": "repos/beta", "deployExempt": false },
    "docs": { "id": 103, "path": "docs", "deployExempt": true }
  },
  "policy": {
    "judgeId": "TEST-POLICY-v1.1",
    "acceptedIds": ["TEST-POLICY-v1.0", "TEST-POLICY-v1.1"],
    "docs": ["guide/policy.md#5.", "guide/workflow.md#3.1.1"]
  },
  "contract": { "lines": ["Policy", "Policy source", "Review type", "Reviewer role", "Baseline", "Base SHA", "Review head SHA", "Required acceptance criteria", "Required tests/evidence", "Human reviewer"] },
  "baselineCandidates": ["docs/specs/**", "docs/*-design.md"],
  "docsMap": {
    "always": ["guide/policy.md#0."],
    "rules": [
      { "match": ["**/mapper/**/*.xml", "**/*.sql"], "docs": ["architecture/database.md"] },
      { "match": ["**/auth/**"], "docs": ["security/README.md"] }
    ]
  },
  "wiki": {
    "roots": [
      { "path": "~/wiki-team", "export": true, "glossary": "glossary.md" },
      { "path": "~/wiki-private", "export": false, "glossary": "glossary.md" }
    ],
    "linesPerPage": 8,
    "pagesPerPack": 3
  },
  "mask": [
    { "name": "phone", "pattern": "01[016789]-?\\d{3,4}-?\\d{4}" },
    { "name": "rrn", "pattern": "\\d{6}-?[1-4]\\d{6}" },
    { "name": "email", "pattern": "[\\w.+-]+@[\\w-]+\\.[\\w.-]+" },
    { "name": "token", "pattern": "(?<=(?:token=|Authorization:\\s*))(?:(?:Bearer|Basic|Token|Digest)\\s+)?[^\\s\\]]+" },
    { "name": "otp", "pattern": "(?<=(?:인증번호|OTP)[^\\n]{0,40}?)\\b\\d{6}\\b" }
  ],
  "deploy": {
    "targets": ["src/main/**", "assets/**", "**/*.sql"],
    "excludes": ["docs/**", ".gitlab/**", "AGENTS.md", "CLAUDE.md", "README*", "src/test/**"]
  },
  "comments": {
    "verdictFirstLine": "^리뷰 계약 (?<policy>TEST-POLICY-v1\\.[01]) · head (?<sha>[0-9a-f]{7,40}) · (?<kind>추천 판정\\(초안\\)|사람 판정) (?<verdict>APPROVE|HOLD_EVIDENCE|CHANGES_REQUESTED|RETURN_TO_DESIGN)",
    "baselineConfirm": "^기준선 확인",
    "authorToken": "^(?<token>FIXED|EVIDENCE|BASELINE_UPDATED|REFUTED|FOLLOW_UP_REQUESTED)\\b\\s*(?<arg>\\S+)?",
    "trustedReviewers": ["lead-reviewer"]
  },
  "report": { "dir": "reviews" }
}
```
