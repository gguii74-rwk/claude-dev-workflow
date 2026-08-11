#!/usr/bin/env python3
# 픽스처 실측 검사 — 7a README의 체크리스트(게이트 실측 / base diff 비공집합 /
# 문서가 주장하는 상태와 실제 커밋 일치)를 픽스처마다 돌린다. 실패는 전부 출력한다.
import subprocess, pathlib, re, sys, json, unicodedata

H = pathlib.Path(__file__).resolve().parent
FIX = H / "fix"

# 0.16.0 감량판(fp-I1): new 규격 상태 파일에 폐기된 폴백② 상태 필드 잔존 금지
# (NFC 정규화 대조 — 픽스처 파일이 NFD로 저장돼 리터럴 grep이 빗나간 실측)
DEPRECATED_FB = unicodedata.normalize("NFC", "폴백② 허용")

# 사례별 기대: (작업 트리 상태, .remember 추적 여부, 루프 파일 수(new 기준))
EXPECT = {
    "l1-c1": ("clean", False, 0),
    "l2-c1": ("clean", False, 1),
    "l3-c1": ("clean", False, 0),
    "l3-c2": ("clean", False, 1),
    "l3-c3": ("clean", False, 1),
    "l3-c4": ("clean", False, 1),
    "l3-c5": ("clean", False, 2),
    "l4-c1": ("dirty", False, 0),
    "l4-c2": ("dirty", False, 0),
    "l4-c3": ("dirty", False, 1),
    "l4-c4": ("dirty", True, 1),
    "l5-c1": ("clean", False, 1),
    "l5-c2": ("clean", False, 1),
    "l5-c3": ("clean", False, 1),
    "b-c1": ("clean", False, 0),
    "b-c2": ("clean", False, 0),
    "d-c1": ("clean", False, 1),
}

fails = []

def sh(cwd, *a):
    r = subprocess.run(a, cwd=cwd, capture_output=True, text=True)
    return r.returncode, r.stdout.strip(), r.stderr.strip()

def fail(where, msg):
    fails.append(f"{where}: {msg}")

for case, (tree, tracked, nloop) in EXPECT.items():
    for arm in ("cur", "new", "none"):
        p = FIX / case / arm
        where = f"{case}/{arm}"
        if not p.exists():
            fail(where, "디렉터리 없음"); continue

        _, head, _ = sh(p, "git", "rev-parse", "HEAD")
        _, mainsha, _ = sh(p, "git", "rev-parse", "main")
        _, branch, _ = sh(p, "git", "branch", "--show-current")

        # 2) base diff 공집합 금지
        _, diff, _ = sh(p, "git", "diff", "--name-only", "main...HEAD")
        if not diff:
            fail(where, "base(main) diff가 공집합")

        # 4) 작업 트리 상태 — .remember 제외 여부와 무관하게 실제 status로 확인
        _, st, _ = sh(p, "git", "status", "--porcelain")
        lines = [l for l in st.splitlines() if l.strip()]
        non_remember = [l for l in lines if ".remember/" not in l]
        if tree == "clean" and non_remember:
            fail(where, f"clean 기대인데 미커밋 변경: {non_remember}")
        if tree == "dirty" and not non_remember:
            fail(where, "dirty 기대인데 미커밋 변경 없음")

        # 5) .remember 추적 여부
        _, ls, _ = sh(p, "git", "ls-files", ".remember")
        if tracked and not ls:
            fail(where, ".remember 추적 기대인데 tracked 파일 0")
        if not tracked and ls:
            fail(where, f".remember 비추적 기대인데 tracked: {ls}")

        # 3) 상태 파일이 주장하는 SHA·branch가 실제와 일치하는가
        loops = sorted((p / ".remember").glob("loop-*.md"))
        if arm == "cur":
            if loops:
                fail(where, f"cur arm에 루프 파일이 있다: {[f.name for f in loops]}")
            rm = (p / ".remember/remember.md").read_text(encoding="utf-8")
            # 블록이 여러 개면 각각을 독립 상태로 본다(트랙마다 ledger 문서가 다르다)
            state_texts = rm.split("## review-loop 미완 상태")[1:]
        else:
            if len(loops) != nloop:
                fail(where, f"루프 파일 {len(loops)}개 (기대 {nloop})")
            state_texts = [f.read_text(encoding="utf-8") for f in loops]
            for f, txt in zip(loops, state_texts):
                if DEPRECATED_FB in unicodedata.normalize("NFC", txt):
                    fail(where, f"폐기 필드(폴백② 허용/소비) 잔존: {f.name}")

        for txt in state_texts:
            for sha in re.findall(r"중단 시 HEAD SHA: `([0-9a-f]+)`", txt):
                if not head.startswith(sha):
                    fail(where, f"HEAD SHA 불일치: 상태={sha} 실제={head[:7]}")
            for sha in re.findall(r"base: `main` @ `([0-9a-f]+)`", txt):
                if not mainsha.startswith(sha):
                    fail(where, f"base SHA 불일치: 상태={sha} 실제={mainsha[:7]}")
            for br in re.findall(r"branch: `([^`]+)`", txt):
                if br != branch:
                    fail(where, f"branch 불일치: 상태={br} 실제={branch}")
            for doc in re.findall(r"ledger 단일 원본: `([^`]+)`", txt):
                if not (p / doc).exists():
                    fail(where, f"ledger 문서 없음: {doc}")
                    continue
                # 상태가 주장하는 소진·큐가 **커밋된** ledger와 맞는가
                # (미커밋분은 아직 그 라운드를 반영하지 않은 상태여야 한다)
                rc, committed, _ = sh(p, "git", "show", f"HEAD:{doc}")
                if rc != 0:
                    fail(where, f"ledger 문서가 커밋돼 있지 않다: {doc}"); continue
                adv = re.search(r"적대 라운드 소진: (\d+) /", txt)
                conf = re.search(r"확인 라운드 소진: (\d+) /", txt)
                rounds = sorted(int(x) for x in set(re.findall(r"^\| R(\d+) \|", committed, re.M)))
                confs = sorted(int(x) for x in set(re.findall(r"^\| C(\d+) \|", committed, re.M)))
                # 커밋된 라운드 수 ≤ 소진 카운트 ≤ 커밋된 라운드 수 + 1
                # (+1은 아직 커밋되지 않은 마지막 라운드 몫이다 — l4 계열)
                nr, nc = (max(rounds) if rounds else 0), len(confs)
                if adv and not (nr <= int(adv.group(1)) <= nr + 1):
                    fail(where, f"적대 소진 {adv.group(1)} ↔ 커밋 ledger 라운드 {rounds}")
                if conf and not (nc <= int(conf.group(1)) <= nc + 1):
                    fail(where, f"확인 소진 {conf.group(1)} ↔ 커밋 ledger 확인 라운드 {confs}")
                for fp in sorted(set(re.findall(r"`(fp-\d+)`", txt))):
                    if fp not in committed:
                        fail(where, f"상태가 든 {fp}이 커밋 ledger에 없다")

        # 1) 게이트 실측 (package.json이 있는 픽스처만)
        if (p / "package.json").exists():
            for cmd in ("typecheck", "lint", "test", "build"):
                rc, out, err = sh(p, "npm", "run", "--silent", cmd)
                if rc != 0:
                    fail(where, f"게이트 실패: npm run {cmd} → {err[:120]}")

print(f"검사 대상: {len(EXPECT)} 사례 × 3 arm")
if fails:
    print(f"\n실패 {len(fails)}건:")
    for f in fails:
        print("  -", f)
    sys.exit(1)
print("전건 통과")
