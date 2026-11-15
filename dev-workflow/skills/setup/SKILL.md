---
name: setup
description: Use ONLY when the user explicitly asks to adopt, set up, or pin the dev-workflow pipeline in the current repository — e.g. "이 repo에 dev-workflow 세팅해줘", "set up the dev-workflow pipeline here", "CLAUDE.md에 파이프라인 규약 넣어줘". Does NOT trigger on general questions or on plugin install.
---

# setup

**Announce:** "setup으로 이 repo의 CLAUDE.md에 dev-workflow 파이프라인 포인터를 추가하고, 자동 압축 지점(`autoCompactWindow`)을 제안합니다."

## 하는 일

프로젝트 CLAUDE.md에 **파이프라인 규약 포인터**(전체 가이드 아님)를 마커 블록으로 멱등 삽입한다. 규약 본문(SSOT)은 `dev-cycle` 스킬에 있고 여기엔 그리로의 포인터만 둔다 — 파이프라인이 바뀌어도 CLAUDE.md는 낡지 않는다.

이어서 **자동 압축 지점**(`autoCompactWindow`)을 제안해 settings.json에 적는다. 한 단계 안의 대화 길이는 Claude Code의 자동 압축이 관리한다 — 설정이 없으면 1M 모델은 약 967K에서 압축된다. 이 플러그인의 출발값은 60만이다(조정 중인 값).

## 절차

1. repo 루트 `CLAUDE.md`를 찾는다. 없으면 **생성 여부를 사용자에게 확인**한다.
2. 아래 마커 블록이 이미 있으면(`<!-- dev-workflow:pipeline -->`) **그 블록만 교체**, 없으면 파일 끝에 **append**한다. 마커 밖 기존 내용은 건드리지 않는다(surgical).

```
<!-- dev-workflow:pipeline -->
## 개발 워크플로 (dev-workflow)

이 repo의 기능 개발·코드 변경은 dev-workflow 파이프라인을 따른다 — **새 기능이든 한 단계짜리 작은 변경이든, 코드를 건드리기 전에** `/dev-workflow:dev-cycle`(또는 "개발 사이클")로 **경로(정식·경량)와 현재 단계**를 확인한다. **이 repo에서는 경로 판정이 항상 필요하다** — 규모는 기준이 아니고, 무엇을 생략할지는 지도가 판정한다.

플러그인 미설치 시: `/plugin marketplace add gguii74-rwk/claude-dev-workflow` → `/plugin install dev-workflow@claude-dev-workflow`.
<!-- /dev-workflow:pipeline -->
```

3. **압축 지점 설정**(`autoCompactWindow`):
   1. **현재 값을 조회한다** — 글로벌 `~/.claude/settings.json`(또는 `CLAUDE_CONFIG_DIR`) · 프로젝트 `.claude/settings.json` · `.claude/settings.local.json`의 최상위 `autoCompactWindow` · `modelSettings` 아래 모델별 `autoCompactWindow` · 옛 변수와, 셸의 `CLAUDE_CODE_AUTO_COMPACT_WINDOW`를 본다. **그 값들만 뽑아 읽는다** — 줄 전체를 찍으면 같은 줄의 비밀값이 출력에 남는다. repo 루트에서:

      ```bash
      node -e '
      const fs=require("fs"),O=v=>!!v&&typeof v==="object"&&!Array.isArray(v);
      const V=v=>typeof v==="number"||typeof v==="boolean"||(typeof v==="string"&&v.length<=40)?String(v):"형식 이상";
      const e=process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW;if(e!==undefined)console.log("셸\tCLAUDE_CODE_AUTO_COMPACT_WINDOW\t"+V(e));
      for(const f of process.argv.slice(1)){let s;try{s=JSON.parse(fs.readFileSync(f,"utf8"))}catch(x){console.log(f+"\t"+(x.code==="ENOENT"?"없음":"읽기·파싱 실패"));continue}
       if(!O(s)){console.log(f+"\t읽기·파싱 실패");continue}const L=[];
       if("autoCompactWindow" in s)L.push("autoCompactWindow\t"+V(s.autoCompactWindow));
       if(O(s.modelSettings))for(const m in s.modelSettings)if(O(s.modelSettings[m])&&"autoCompactWindow" in s.modelSettings[m])L.push("modelSettings."+V(m)+".autoCompactWindow\t"+V(s.modelSettings[m].autoCompactWindow));
       if(O(s.env))for(const k of ["CLAUDE_CTX_LIMIT","CLAUDE_CTX_THRESHOLD"])if(k in s.env)L.push("env."+k+"\t"+V(s.env[k])+" (더는 쓰이지 않는다)");
       console.log(L.length?L.map(l=>f+"\t"+l).join("\n"):f+"\t값 없음")}
      ' "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json" .claude/settings.json .claude/settings.local.json
      ```

      이미 값이 있으면 어디에 얼마로 있는지 밝힌다.
   2. **AskUserQuestion 1회로 두 질문을 함께 받는다**(왕복 1회):
      - **값** — 최상위 값이 이미 있으면 **"현재 값 유지"** / `600000`으로 바꿈. 없으면 `600000` — 설명에 「이 플러그인이 쓰는 출발값이다 — 기본(1M 모델 약 967K)보다 일찍 요약한다 · 조정 중인 값」을 밝힌다 / **건너뜀**(모델 기본값). 200K 모델에서는 모델 창으로 깎여 영향이 없다는 것을 한 줄로 밝힌다.
      - **쓸 위치** — **글로벌**(`~/.claude/settings.json` — 이 머신 전체·권장) / **프로젝트 로컬**(`.claude/settings.local.json` — 이 repo + 이 머신만, 보통 git 미추적) / **프로젝트**(`.claude/settings.json` — 이 repo만). 프로젝트 선택지 설명에 **"커밋하면 협업자에게도 적용된다"**를 명시한다.
   3. 건너뜀 · 유지가 아니면 선택한 settings.json의 **최상위 `autoCompactWindow`만** 멱등 반영한다(있으면 교체, 없으면 추가). 다른 키는 그대로 둔다. 파일이 없으면 만든다. **파일을 JSON으로 읽지 못하면(조회의 `읽기·파싱 실패`) 쓰지 않고 그 사실을 알린다** — 다른 설정을 잃지 않는다.
   4. **알린다** — ① **새 세션부터** 적용된다 ② 셸에 `CLAUDE_CODE_AUTO_COMPACT_WINDOW`가 있으면 그 값이 우선한다 ③ 모델별 저장값이 있으면 「모델 〈이름〉에는 〈파일〉에 저장값 〈N〉이 있다 — 바꾸려면 그 모델에서 `/autocompact`」 — 「그 모델에는 그 값이 우선한다」는 이번에 쓴 파일과 **같은 파일**일 때만 붙인다(다른 파일이면 우선을 단정하지 않는다). `modelSettings`는 고치지 않는다 ④ 옛 변수(`env.CLAUDE_CTX_LIMIT` · `env.CLAUDE_CTX_THRESHOLD`)가 남아 있으면 「더는 쓰이지 않는다 — 지워도 된다」만 알린다(지우지 않는다).
4. 변경 결과를 사용자에게 보고한다. **커밋은 하지 않는다** — 사용자가 자신의 커밋 흐름으로 처리한다.

## 하지 말 것

- 전체 파이프라인 가이드를 CLAUDE.md에 복사 → 포인터만(SSOT는 dev-cycle). 드리프트 유발.
- 마커 블록 밖의 기존 CLAUDE.md 내용 수정 → 블록만.
- 명시 요청 없이 자동 실행 → 이 스킬은 사용자가 명시적으로 요청할 때만.
- 압축 관련 다른 설정(모델별 저장값 · 자동 압축 켜고 끄기 · 옛 변수)을 고치거나 지우기 → 이 스킬은 **최상위 `autoCompactWindow`만** 쓴다. 나머지는 알리기만 한다.
- settings.json을 통째로 재작성 → 대상 키만 수정. 다른 설정을 유실시키지 말 것.
