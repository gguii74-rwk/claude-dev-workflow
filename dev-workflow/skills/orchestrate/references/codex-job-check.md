# 닫기 전 codex 잡 확인 (⑤-1 (a))

트랙 터미널에 `/exit`를 보내기 전에 이 폴더의 codex 잡(queued/running)이 0인지 확인한다. `/exit`가 부르는 codex `SessionEnd` 정리가 폴더 공유 브로커를 내려, 같은 폴더의 다른 세션 잡(메인 자신의 잡 포함)을 죽인다.

- **실행 위치** = 그 트랙의 체크아웃 루트(cwd). 두 줄을 **같은 셸에서 차례로** 실행한다(첫 줄이 `CR`을 정한다).
- 상태 파일을 직접 한 번 읽는다 — 자기 세션 잡만 보여 주는 `status` 서브커맨드와 실패를 빈 목록으로 숨기는 `loadState`는 쓰지 않는다. 부재 판정은 `ENOENT`뿐이고, 스키마 이탈 · `CLAUDE_PLUGIN_DATA` 부재는 판독 불가다.

**1. companion 루트 해소**

```bash
P="${CLAUDE_CODE_PLUGIN_CACHE_DIR:-${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins}"; CR=$(node -e 'const fs=require("fs"),p=require("path");let d;try{d=JSON.parse(fs.readFileSync(p.join(process.argv[1],"installed_plugins.json"),"utf8"))}catch{process.exit(1)};const r=e=>e.projectPath===process.argv[2]?0:e.scope==="user"?1:e.scope==="managed"?2:9;const a=((d.plugins||{})["codex@openai-codex"]||[]).filter(e=>r(e)<9).sort((x,y)=>r(x)-r(y))[0];if(!a||!fs.existsSync(p.join(a.installPath,"scripts","lib","state.mjs")))process.exit(1);console.log(a.installPath)' "$P" "$PWD") || echo RESOLVE_FAIL
```

**2. 상태 프로브**

```bash
node -e 'const fs=require("fs");import(require("url").pathToFileURL(process.argv[1]+"/scripts/lib/state.mjs").href).then(m=>{if(!process.env.CLAUDE_PLUGIN_DATA){console.log("STATE_UNREADABLE");process.exit(2)}const f=m.resolveStateFile(process.cwd());let raw;try{raw=fs.readFileSync(f,"utf8")}catch(e){if(e&&e.code==="ENOENT"){console.log("GATE_OFF FOREIGN_ACTIVE=0");return}console.log("STATE_UNREADABLE");process.exit(2)}let s;try{s=JSON.parse(raw)}catch{s=null}const obj=v=>!!v&&typeof v==="object"&&!Array.isArray(v);const jobsOk=v=>Array.isArray(v)&&v.every(j=>obj(j)&&typeof j.status==="string");const cfgOk=v=>obj(v)&&typeof v.stopReviewGate==="boolean";if(!obj(s)||!jobsOk(s.jobs)||!cfgOk(s.config)){console.log("STATE_UNREADABLE");process.exit(2)}const me=process.env.CODEX_COMPANION_SESSION_ID||"";const n=s.jobs.filter(j=>(j.status==="queued"||j.status==="running")&&j.sessionId!==me).length;console.log((s.config&&s.config.stopReviewGate===true?"GATE_ON":"GATE_OFF")+" FOREIGN_ACTIVE="+n)}).catch(()=>{console.log("STATE_UNREADABLE");process.exit(2)})' "$CR"
```

**실행 계약 — 자기 세션 제외를 끈다**: 2번 줄은 실행 세션과 같은 `sessionId`의 잡을 세지 않는다(`CODEX_COMPANION_SESSION_ID` 비교). 이 확인은 메인이 트랙을 닫기 전에 하므로 메인 자신의 잡도 세야 한다 — 그래서 2번 줄은 **앞에 `CODEX_COMPANION_SESSION_ID= `(빈 값) 접두를 붙여** 실행한다(명령 원문은 고치지 않는다). 이때 `FOREIGN_ACTIVE`는 이름과 달리 이 폴더의 queued/running 잡 **전체** 수다.

**판독 규칙**

1. `FOREIGN_ACTIVE=0` → 통과((b)로 간다).
2. 0이 아님 → 보류 · 보고. 같은 상태 파일의 해당 queued/running 잡 id · status · sessionId를 함께 적는다(고아 잡인지 사용자가 판단해 cancel할 수 있게). 기다렸다 다시 세지 않는다.
3. `STATE_UNREADABLE`(읽기 · 파싱 · 스키마 실패 · `CLAUDE_PLUGIN_DATA` 부재) · `RESOLVE_FAIL` → 보류 · 보고(「잡 없음」이 아니다).
4. 상태 파일 부재 = 0건(출력 `GATE_OFF FOREIGN_ACTIVE=0`).
5. 출력 앞의 `GATE_ON` / `GATE_OFF`는 이 확인에서 쓰지 않는다.
