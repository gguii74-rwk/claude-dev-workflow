// deploy.mjs — spec §5.2b. 기대 목록(4.7 규칙·--no-renames) → zip 다운로드 → ①주석 SHA ②목록 ③바이트 ④삭제 목록 대조. 모델 없이.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { apiRaw } from './gitlab.mjs';
import { matchesAny } from './adapter.mjs';
import { insideRoot } from './collect.mjs';
import { maskText, knownShas } from './pack.mjs';

const MAX_BUFFER = 512 * 1024 * 1024;
const MAX_ENTRY = 256 * 1024 * 1024;   // 항목 하나의 비압축 상한(압축 폭탄 — impl SDD 이월 T04①). 소스·리소스 배포본 범위
const MAX_DEPTH = 64;   // zip 항목 이름의 조각 수 상한 — 경로 깊이에 비례하는 검사(경로 충돌·접두 제거·zip 사이 충돌)의 계산량을 묶는다(1.3.3 review-loop(impl) R4-1). 배포본 경로는 보통 20 조각 안팎

function gitZ(cwd, args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: MAX_BUFFER });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} 실패: ${(r.stderr || '').trim().slice(0, 200)}`);
  return r.stdout.split('\0').filter(Boolean);
}

export function expectedLists({ adapter, mr, snap }) {
  const inDeploy = (p) => matchesAny(p, adapter.deploy.targets) && !matchesAny(p, adapter.deploy.excludes);
  let acmr = [];
  let del = [];
  if (snap.mode === 'worktree') {
    acmr = gitZ(snap.checkout, ['diff', '-z', '--no-renames', '--name-only', '--diff-filter=ACMR', snap.base_sha, snap.head_sha]);
    del = gitZ(snap.checkout, ['diff', '-z', '--no-renames', '--name-only', '--diff-filter=D', snap.base_sha, snap.head_sha]);
  } else {
    for (const d of mr.diffs) {
      if (d.deleted_file) del.push(d.old_path);
      else if (d.renamed_file) { del.push(d.old_path); acmr.push(d.new_path); }
      else acmr.push(d.new_path);
    }
  }
  return { deploy: [...new Set(acmr.filter(inDeploy))].sort(), deleted: [...new Set(del.filter(inDeploy))].sort() };
}

// 배포본 zip 배치 프리셋(1.3.2 ⑨ — spec 2026-10-22 3.⑨ D37·D38·D43·D45) — 소스 경로 → zip 경로 + 대조 격(bytes | exists).
// maven-war 접두는 저장소 루트 고정(D45). .java 는 WEB-INF/classes/…class 존재만 대조(D38), src/main/java 아래 그 밖 파일은 WEB-INF/classes/<rest> 바이트 대조(D43). source = 전부 그대로.
const WAR_CLASSES = 'WEB-INF/classes/';
export function zipPathFor(layout, src) {
  if (layout === 'maven-war') {
    if (src.startsWith('src/main/webapp/')) return { zip: src.slice('src/main/webapp/'.length), compare: 'bytes' };
    if (src.startsWith('src/main/resources/')) return { zip: WAR_CLASSES + src.slice('src/main/resources/'.length), compare: 'bytes' };
    if (src.startsWith('src/main/java/')) {
      const rest = src.slice('src/main/java/'.length);
      return rest.endsWith('.java') ? { zip: WAR_CLASSES + rest.slice(0, -'.java'.length) + '.class', compare: 'exists' } : { zip: WAR_CLASSES + rest, compare: 'bytes' };
    }
  }
  return { zip: src, compare: 'bytes' };
}

// 내부 클래스 산출물 → 바깥 클래스 후보를 긴 것부터 하나씩 ok() 로 보고 처음 맞는 것(`Foo$Bar$1.class` → `Foo$Bar.class`, `Foo.class` — `Foo$Bar.java` 의 산출물도 찾게, R2-2). 없으면 null.
// 후보를 미리 만들지 않고, `$` 가 INNER_MAX 개를 넘는 이름은 조회하지 않는다 — zip 이름은 신뢰할 수 없는 입력이라 메모리·시간에 상한(R5-2)
const INNER_MAX = 32;
function findOuterClass(name, ok) {
  const m = name.match(/^(.*\/)?([^/]+)\.class$/);
  if (!m) return null;
  let base = m[2];
  if (base.split('$').length - 1 > INNER_MAX) return null;
  for (let k = base.lastIndexOf('$'); k > 0; k = base.lastIndexOf('$')) { base = base.slice(0, k); const c = `${m[1] || ''}${base}.class`; if (ok(c)) return c; }
  return null;
}

// 「배포본」 줄 아래(같은 절 안) 목록 — 불릿·번호·펜스 한 줄 한 경로. `삭제:` 접두 허용. 경로 모양(구분자 또는 확장자)만 받는다.
export function parseDeletedList(description) {
  const lines = description.split('\n');
  const start = lines.findIndex((l) => /배포본\s*[:：]/.test(l));
  if (start < 0) return [];
  const out = [];
  let fence = false;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^##\s/.test(l)) break;
    if (/^\s*```/.test(l)) { fence = !fence; continue; }
    let s = l.trim();
    if (!fence) {
      if (!/^([-*]|\d+\.)\s/.test(s)) { if (s === '') continue; break; }   // 목록이 끝나면(다른 불릿 아닌 줄) 멈춘다
      s = s.replace(/^([-*]|\d+\.)\s+/, '');
    }
    s = s.replace(/^삭제\s*[:：]\s*/, '').replace(/`/g, '').trim();
    if (!s || /\s/.test(s) || /^\[.*\]\(.*\)$/.test(s) || s.includes('://')) continue;
    if (s.includes('/') || /\.[A-Za-z0-9]+$/.test(s)) out.push(s);
  }
  return [...new Set(out)].sort();
}

const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// 자체 ZIP 리더(P3) — central directory 로 목록, stored(0)·deflate(8) 만. zip64 미지원(git archive 산출물 범위).
// read() 는 central directory 의 CRC-32·비압축 크기와 대조한다 — 표준 리더가 Bad CRC 로 거부할 배포본을 「일치」로 보증하지 않는다.
// 구조 교차 검증(impl SDD 이월 T04③ + R1-8, 사용자 판정) — 우리 리더와 배포 도구(unzip·Python zipfile)가 다른 목록을 읽는 zip 을 「일치」로 보증하지 않는다:
// EOCD 는 파일 끝(주석 길이까지 정확히) · 디스크 번호 0 · 이 디스크 항목 수 = 전체 · 목차 시작 + 목차 크기 = EOCD 위치 = 파싱한 목차의 실제 끝 · 같은 이름 두 번 금지. 어긋나면 throw → corrupt.
// 확장 필드 허용 목록(impl R2-1, 사용자 판정) — git archive 가 쓰는 시간 정보(0x5455)와 Unix 소유자(0x7875)만. Unicode 경로(0x7075)처럼 이름·내용 해석을 바꾸는 칸이나
// 모르는 칸이 있으면 배포 도구가 다르게 읽을 수 있으므로 거부한다(zip64 0x0001 도 미지원). 칸 길이 합이 선언 길이와 맞지 않아도 거부.
const SAFE_EXTRA = new Set([0x5455, 0x7875]);
// 파일명 인코딩(impl R3-2) — zip 표준은 UTF-8 표시(일반 목적 플래그 bit 11)가 없으면 CP437 로 읽는다. 표시 없는 비ASCII 이름은 표준 리더와 자체 리더가 다른 이름을 보므로 거부하고,
// 표시가 있으면 엄격한 UTF-8 로만 읽는다(깨진 바이트 거부). git archive 는 비ASCII 이름에 표시를 켠다(2.43 실측) — 정상 배포본은 통과한다.
const UTF8 = new TextDecoder('utf-8', { fatal: true });
// 보이는 이름 ≠ 실제 이름(1.3.4 S2 — spec 2026-10-23 3.S2-1 D76·D78) — 유니코드 범주 Cc(제어 — C0·C1·DEL)·Cf(서식 — 양방향·폭 0·BOM 등)·Zl·Zp 로 닫는다(열거 목록 아님). zip 항목 이름·첨부 파일명 두 입구가 쓴다
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
const hasInvisible = (name) => INVISIBLE.test(name);
// 거부한 이름의 표시용 꼴(R1-1·D87) — JSON.stringify 가 남기는 범주 문자(NEL·U+2028·양방향 등)까지 \uXXXX 로 — 진단이 원문 문자를 다시 실어 나르지 않는다
// 첨부 파일명 칸·다중 zip 앞머리(review-loop(impl) R1-3)는 따옴표 없이 범주 문자만 — 정상 이름은 바이트 그대로
const showText = (s) => (s == null ? s : String(s).replace(new RegExp(INVISIBLE.source, 'gu'), (c) => `\\u${c.codePointAt(0).toString(16).padStart(4, '0')}`));
const showName = (s) => showText(JSON.stringify(s));
function zipName(raw, flags) {
  if (!(flags & 0x0800) && raw.some((b) => b >= 0x80)) throw new Error(`zip 파일명이 UTF-8 표시 없이 비ASCII(표준 리더와 이름이 달라짐): ${showName(raw.toString('latin1'))}`);
  let name;
  try { name = UTF8.decode(raw); } catch { throw new Error(`zip 파일명이 올바른 UTF-8 이 아님: ${showName(raw.toString('latin1'))}`); }
  // 왕복 대조(impl R4-4) — 해독기가 몰래 바꾼 이름(앞 BOM 제거 등)은 다른 리더와 이름이 갈린다
  if (!Buffer.from(name, 'utf8').equals(raw)) throw new Error(`zip 파일명이 UTF-8 왕복에서 바뀜(BOM 등): ${showName(raw.toString('latin1'))}`);
  // 제어문자(impl R5-2 — NUL 에서 이름을 자르는 리더는 `x.js\0/`(우리에겐 폴더)를 일반 파일 `x.js` 로 푼다) + 서식·줄 구분 문자(1.3.4 D76)
  if (hasInvisible(name)) throw new Error(`zip 파일명에 제어문자·서식·줄 구분 문자(보이는 이름과 다를 수 있음): ${showName(name)}`);
  if (notCanonical(name)) throw new Error(`zip 파일명이 정규형이 아님: ${showName(name)}`);
  if (name.replace(/\/$/, '').split('/').length > MAX_DEPTH) throw new Error(`zip 파일명 경로 깊이 상한 초과(${MAX_DEPTH} 조각): ${showName(name.slice(0, 120))}…`);
  return name;
}

// 정규형만(impl R6-3 훅) — 앞 `/`·역슬래시·빈 조각·`.`·`..` 는 해제 도구가 경로를 정리하며 다른 위치·충돌을 만든다(git archive 이름은 항상 정규형).
// 드라이브 접두(`C:/…`·`C:…` — 1.3.2 R4-1)도 절대·드라이브 상대 경로라 Windows 해제 도구가 배포 루트 밖을 가리킨다. zip 항목 이름과 매핑한 배포·삭제 경로(R5-1)가 같이 쓴다
function notCanonical(name) {
  return name.startsWith('/') || /^[A-Za-z]:/.test(name) || name.includes('\\') || name.replace(/\/$/, '').split('/').some((s) => s === '' || s === '.' || s === '..');
}

// local 헤더 crc·csize·usize = 목차 — bit 3 항목은 각각 0 도(Info-ZIP 스트리밍은 usize 만 실제값 · Java·Python 은 셋 다 0 — 1.3.4 D70)
function localMatches(buf, at, e) {
  const dd = (e.flags & 0x0008) !== 0;
  return [[14, e.crc], [18, e.csize], [22, e.usize]].every(([o, v]) => { const l = buf.readUInt32LE(at + o); return l === v || (dd && l === 0); });
}

function checkExtra(buf, start, len, name, where) {
  let q = start;
  const end = start + len;
  if (end > buf.length) throw new Error(`zip ${where} 확장 필드 범위 초과: ${name}`);
  while (q < end) {
    if (q + 4 > end) throw new Error(`zip ${where} 확장 필드 손상: ${name}`);
    const id = buf.readUInt16LE(q);
    const n = buf.readUInt16LE(q + 2);
    if (q + 4 + n > end) throw new Error(`zip ${where} 확장 필드 길이 불일치: ${name}`);
    if (!SAFE_EXTRA.has(id)) throw new Error(`zip ${where} 확장 필드 미지원(0x${id.toString(16).padStart(4, '0')}): ${name}`);
    q += 4 + n;
  }
}

export function readZip(buf) {
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === EOCD && i + 22 + buf.readUInt16LE(i + 20) === buf.length) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip EOCD 없음(또는 EOCD 가 파일 끝이 아님)');
  const count = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOff = buf.readUInt32LE(eocd + 16);
  const cLen = buf.readUInt16LE(eocd + 20);
  if (buf.readUInt16LE(eocd + 4) !== 0 || buf.readUInt16LE(eocd + 6) !== 0) throw new Error('zip EOCD 디스크 번호가 0 이 아님(분할 zip 미지원)');
  if (buf.readUInt16LE(eocd + 8) !== count) throw new Error('zip EOCD 항목 수 불일치(이 디스크 ≠ 전체)');
  if (cdOff + cdSize !== eocd) throw new Error(`zip EOCD 목차 범위 불일치(시작 ${cdOff} + 크기 ${cdSize} ≠ EOCD ${eocd})`);
  const comment = buf.subarray(eocd + 22, eocd + 22 + cLen).toString('utf8');
  const entries = [];
  const seen = new Set();
  let p = cdOff;
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip central directory 손상');
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nLen = buf.readUInt16LE(p + 28);
    const eLen = buf.readUInt16LE(p + 30);
    const cmLen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const raw = buf.subarray(p + 46, p + 46 + nLen);
    const name = zipName(raw, flags);
    if (seen.has(name)) throw new Error(`zip 중복 항목 이름: ${name}`);
    seen.add(name);
    checkExtra(buf, p + 46 + nLen, eLen, name, 'central');
    // 항목 유형(impl R1-6) — Unix(made-by 상위 바이트 3)면 외부 속성 상위 16비트가 st_mode. 링크·특수 파일을 일반 파일로 보지 않는다
    const made = buf.readUInt16LE(p + 4) >>> 8;
    const ifmt = ((buf.readUInt32LE(p + 38) >>> 16) & 0o170000);
    const type = made !== 3 || ifmt === 0 || ifmt === 0o100000 ? 'file' : ifmt === 0o120000 ? 'symlink' : ifmt === 0o040000 ? 'dir' : 'special';
    // `/` 로 끝나는 항목은 대조에서 빠지므로(폴더) 내용이 없을 때만 폴더로 인정한다(impl R5-2 — git archive 폴더 항목은 크기 0, 실측)
    if (name.endsWith('/') && usize !== 0) throw new Error(`zip 폴더 항목에 내용이 있음(${usize}바이트): ${name}`);
    entries.push({ name, raw, flags, method, crc, csize, usize, lho, cd: p, type });
    p += 46 + nLen + eLen + cmLen;
  }
  if (p !== eocd) throw new Error(`zip EOCD 목차 크기 불일치(파싱한 목차 끝 ${p} ≠ EOCD ${eocd})`);
  // 허용 레이아웃(8b FR1-3, 추천 자동 채택(위임)) — 거부 목록을 늘리는 대신 허용하는 배치만 통과시킨다: 파일 맨 앞(0)부터 local 레코드(헤더 + 이름 + 확장 + 데이터)가 오프셋 순으로
  // 빈틈·겹침 없이 이어지고 마지막 레코드 끝이 목차 시작과 같아야 한다. 목차에 없는 local 항목(앞에 끼운 항목·항목 사이 바이트·prepend 데이터)은 순차 리더(funzip·ZipInputStream 등)만
  // 푸는 내용이라 「일치」로 보증하지 않는다.
  // data descriptor(bit 3 — 1.3.4 ⑰, spec 2026-10-23 3.⑰ D70·D71·D75·D85·D86): 목차 기준 + 서명 있는 16바이트 꼬리표만 받는다(impl R4-1 「거부」 변경) — deflate 만(stored 는 스트리밍 리더가 경계를 정할 수 없음) ·
  // local crc·csize·usize 는 각각 0 또는 목차 값 · 목차 csize 뒤에 꼬리표(서명·CRC·두 크기 = 목차) · 그 뒤 다음 항목이 빈틈 없이 연속 · 파일 항목은 여기서 바로 풀어 스트림이 정확히 목차 csize 에서 끝나는지 본다
  // (짧은 스트림 뒤 빈자리에 「꼬리표 + 숨은 local 레코드」를 넣으면 순차 리더만 푸는 파일이 생긴다 — 읽지 않는 항목(초과·배포 제외)까지 전수, 풀린 내용은 버린다)
  let at = 0;
  for (const e of [...entries].sort((a, b) => a.lho - b.lho)) {
    if (e.lho !== at) throw new Error(`zip 레이아웃 불일치 — 목차에 없는 데이터 또는 겹침(오프셋 ${at} ≠ 항목 시작 ${e.lho}): ${e.name}`);
    const dd = (e.flags & 0x0008) !== 0;
    const dir = e.name.endsWith('/');
    if (dd && e.method === 0) throw new Error(`zip data descriptor 가 있는 stored 항목(스트리밍 리더가 경계를 정할 수 없음): ${e.name}`);
    if (at + 30 > cdOff || buf.readUInt32LE(at) !== 0x04034b50) throw new Error(`zip local header 손상: ${e.name}`);
    // 모든 항목(폴더 포함)의 local 헤더를 목차와 먼저 대조한다(8b FR2-1, 추천 자동 채택(위임)) — 폴더는 read() 를 거치지 않으므로, 목차엔 빈 폴더 `padding/` · local 엔 `evil.jsp` + 내용인
    // 항목이 순차 리더에서만 파일로 풀린다. 이름(원시 바이트)·플래그·압축 방식·CRC·두 크기가 같아야 한다(bit 3 이면 local 값 0 도 — D70). 폴더 크기는 아래(D71).
    const lnLen = buf.readUInt16LE(at + 26);
    const leLen = buf.readUInt16LE(at + 28);
    if (!buf.subarray(at + 30, at + 30 + lnLen).equals(e.raw)) throw new Error(`zip local header 파일명 불일치: ${e.name}`);
    if (buf.readUInt16LE(at + 6) !== e.flags || buf.readUInt16LE(at + 8) !== e.method) throw new Error(`zip local header 플래그·압축 방식 불일치: ${e.name}`);
    if (!localMatches(buf, at, e)) throw new Error(`zip local header CRC·크기 불일치(목차와 다름): ${e.name}`);
    // 허용 검증은 모든 항목(폴더 포함)에 공통(8b FR3-4, 추천 자동 채택(위임)) — read() 를 거치지 않는 폴더도 암호화·미지원 압축 방식·CRC 있는 빈 폴더면 표준 리더가 거부하는 zip 이다
    if (e.flags & 0x0041) throw new Error(`zip 암호화 플래그(미지원): ${e.name}`);
    if (e.method !== 0 && e.method !== 8) throw new Error(`지원하지 않는 압축 방식(${e.method}): ${e.name}`);
    if (e.name.endsWith('/') && e.crc !== 0) throw new Error(`zip 폴더 항목에 CRC 가 있음(${e.crc.toString(16)}): ${e.name}`);
    checkExtra(buf, at + 30 + lnLen, leLen, e.name, 'local');
    const data = at + 30 + lnLen + leLen;
    const end = data + e.csize;
    if (dd && (end + 16 > cdOff || buf.readUInt32LE(end) !== 0x08074b50 || buf.readUInt32LE(end + 4) !== e.crc || buf.readUInt32LE(end + 8) !== e.csize || buf.readUInt32LE(end + 12) !== e.usize)) throw new Error(`zip data descriptor 없음 또는 값이 목차와 다름(서명·CRC·크기): ${e.name}`);
    // 폴더(D71·D85): 압축 크기 0 또는 풀면 0바이트가 되는 deflate 빈 스트림(≤ 64바이트 · 전부 소비 — Java·Python 이 쓰는 꼴). bit 3 폴더는 스트리밍 리더가 헤더 바로 뒤를 deflate 로 풀므로 빈 스트림이 실제로 있어야 한다
    if (dir && dd && e.csize === 0) throw new Error(`zip data descriptor 항목의 압축 스트림 경계가 목차와 다름(숨은 레코드 가능): ${e.name}`);
    if (dir && e.csize !== 0) {
      let r = null;
      if (e.method === 8 && e.csize <= 64) { try { r = zlib.inflateRawSync(buf.subarray(data, end), { maxOutputLength: 1, info: true }); } catch { r = null; } }
      if (!r || r.buffer.length !== 0 || r.engine.bytesWritten !== e.csize) throw new Error(`zip 폴더 항목에 데이터가 있음(${e.csize}바이트): ${e.name}`);
    }
    // stored 크기 일치(D86) — 순차 리더는 stored 경계를 비압축 크기로 정하므로 남는 바이트에 숨긴 레코드는 그 리더만 푼다(읽지 않는 항목 포함 전수 — 숫자 비교 1회)
    if (e.method === 0 && e.csize !== e.usize) throw new Error(`zip stored 항목의 압축·비압축 크기가 다름(숨은 레코드 가능): ${e.name}`);
    if (dd && !dir) {
      if (e.usize > MAX_ENTRY) throw new Error(`zip 항목 비압축 크기 상한 초과(${e.usize} > ${MAX_ENTRY}): ${e.name}`);
      let r = null;
      try { r = zlib.inflateRawSync(buf.subarray(data, end), { maxOutputLength: Math.max(1, e.usize), info: true }); } catch { r = null; }
      if (!r || r.engine.bytesWritten !== e.csize || r.buffer.length !== e.usize) throw new Error(`zip data descriptor 항목의 압축 스트림 경계가 목차와 다름(숨은 레코드 가능): ${e.name}`);
    }
    at = end + (dd ? 16 : 0);
  }
  if (at !== cdOff) throw new Error(`zip 레이아웃 불일치 — 마지막 항목 끝 ${at} ≠ 목차 시작 ${cdOff}(목차에 없는 데이터)`);
  // 경로 충돌(impl C1 N2) — 파일과 같은 경로의 폴더 항목(`a.txt/`)이나 파일 아래 항목(`a.txt/b`)은 표준 리더가 충돌로 실패하거나 다르게 푼다(폴더는 대조에서 빠지므로 우리만 「일치」)
  // 대소문자 무시(impl R6-3 훅) — 대소문자를 구분하지 않는 파일 시스템에서 풀면 `A.txt`·`a.txt`·`A.TXT/` 가 같은 경로다
  const fileNames = new Set(entries.filter((e) => !e.name.endsWith('/')).map((e) => e.name.toLowerCase()));
  const seenPath = new Set();
  for (const e of entries) {
    const key = e.name.replace(/\/$/, '').toLowerCase();
    if (seenPath.has(key)) throw new Error(`zip 경로 충돌(대소문자·폴더 표기만 다른 같은 경로): ${e.name}`);
    seenPath.add(key);
    const segs = key.split('/');
    for (let k = 1; k < segs.length; k++) {
      const pre = segs.slice(0, k).join('/');
      if (fileNames.has(pre)) throw new Error(`zip 경로 충돌(파일 ${pre} 아래 항목): ${e.name}`);
    }
  }
  const read = (e) => {
    const h = e.lho;
    if (h + 30 > buf.length || buf.readUInt32LE(h) !== 0x04034b50) throw new Error(`zip local header 손상: ${e.name}`);
    const nLen = buf.readUInt16LE(h + 26);
    const eLen = buf.readUInt16LE(h + 28);
    // local header ↔ central directory 정합(R3-8) — 파일명·압축 방식이 다르면 표준 리더가 거부하는 zip 이다
    const lRaw = buf.subarray(h + 30, h + 30 + nLen);
    const lMethod = buf.readUInt16LE(h + 8);
    if (!lRaw.equals(e.raw)) throw new Error(`zip local header 파일명 불일치(${lRaw.toString('utf8')} ≠ ${e.name})`);   // 원시 바이트로 대조(impl R3-2)
    if (lMethod !== e.method) throw new Error(`zip local header 압축 방식 불일치(${lMethod} ≠ ${e.method}): ${e.name}`);
    checkExtra(buf, h + 30 + nLen, eLen, e.name, 'local');
    // 일반 목적 플래그도 대조(C1 R3-8 잔존) — local 0·central 1(암호화) 처럼 어긋나면 표준 리더가 거부하는 zip 이고, 암호화(bit0)·강한 암호화(bit6)는 미지원이라 읽을 수 없는 배포본이다
    const lFlags = buf.readUInt16LE(h + 6);
    if (lFlags !== e.flags) throw new Error(`zip local header 플래그 불일치(${lFlags} ≠ ${e.flags}): ${e.name}`);
    if (e.flags & 0x0041) throw new Error(`zip 암호화 플래그(미지원): ${e.name}`);
    // local 크기·CRC 대조(impl R4-1) — 표준 리더는 local 값으로 풀 수 있어 목차와 다르면 다른 바이트가 나온다. data descriptor(bit 3)는 각각 0 도 허용하고 목차 값으로 푼다(1.3.4 D70 — 꼬리표는 레이아웃 검사가 대조)
    if (!localMatches(buf, h, e)) throw new Error(`zip local header CRC·크기 불일치(목차와 다름): ${e.name}`);
    const start = h + 30 + nLen + eLen;
    if (start + e.csize > buf.length) throw new Error(`zip 데이터 범위 초과: ${e.name}`);
    const data = buf.subarray(start, start + e.csize);
    // 압축 폭탄(impl SDD 이월 T04① + R1-7) — 선언 크기를 먼저 상한과 대조하고, 풀기는 선언 크기까지만 허용한다(넘으면 할당 전에 멈춘다)
    if (e.usize > MAX_ENTRY) throw new Error(`zip 항목 비압축 크기 상한 초과(${e.usize} > ${MAX_ENTRY}): ${e.name}`);
    let out;
    if (e.method === 0) out = Buffer.from(data);
    else if (e.method === 8) {
      let r;
      try { r = zlib.inflateRawSync(data, { maxOutputLength: Math.max(1, e.usize), info: true }); }
      catch (err) { throw new Error(`zip 압축 해제가 선언 크기(${e.usize})를 넘거나 손상: ${e.name} (${err.code || err.message})`); }
      // 스트림 완전 소비(8b FR3-5, 추천 자동 채택(위임)) — inflate 는 스트림 끝 뒤 바이트를 무시하지만 표준 리더는 크기 불일치로 거부한다
      if (r.engine.bytesWritten !== e.csize) throw new Error(`zip 압축 데이터 손상 — 스트림 뒤 미소비 바이트(소비 ${r.engine.bytesWritten} ≠ 압축 크기 ${e.csize}): ${e.name}`);
      out = r.buffer;
    }
    else throw new Error(`지원하지 않는 압축 방식(${e.method}): ${e.name}`);
    if (out.length !== e.usize) throw new Error(`zip 크기 불일치(${out.length} ≠ ${e.usize}): ${e.name}`);
    const c = crc32(out);
    if (c !== e.crc) throw new Error(`zip CRC 불일치(${c.toString(16)} ≠ ${e.crc.toString(16)}): ${e.name}`);
    return out;
  };
  return { comment, entries, read };
}

// git 트리의 항목 유형 — 100644·100755 = file · 120000 = symlink · 그 밖(서브모듈 등)·부재 = other
function gitType(cwd, sha, p) {
  const r = spawnSync('git', ['-C', cwd, 'ls-tree', sha, '--', p], { encoding: 'utf8' });
  const mode = r.status === 0 ? (r.stdout.trim().split(/\s+/)[0] || '') : '';
  return mode === '100644' || mode === '100755' ? 'file' : mode === '120000' ? 'symlink' : 'other';
}

// 첨부 파일명(impl SDD 이월 T04②, 사용자 판정) — 본문의 링크 파일명은 URL 인코딩된 외부 입력이다. 한 번 디코딩해 경로 성분(`/`·`\`·`..`·NUL)이 있으면 거부하고,
// 아니면 다시 인코딩해 API 경로에 붙인다(다른 GitLab 엔드포인트로 새지 않게). secret 도 32자 16진수만.
export function uploadName(att) {
  let name;
  try { name = decodeURIComponent(String(att.filename || '')); } catch { return null; }
  if (!name || name === '.' || name === '..' || /[\/\\\0]/.test(name) || hasInvisible(name) || !/^[0-9a-f]{32}$/.test(String(att.secret || ''))) return null;
  return name;
}

function gitShow(cwd, sha, p) {
  const r = spawnSync('git', ['-C', cwd, 'show', `${sha}:${p}`], { maxBuffer: MAX_BUFFER });
  if (r.status !== 0) return null;
  return r.stdout;
}

// zip 마다 배치 판별(1.3.3 ⑬ — spec 2026-10-23 3.⑬ D57~D60·D63~D66). 배치는 프로젝트가 아니라 작성자·MR 마다 다르다 — 어댑터 deployLayout 은 판별 못 할 때의 기본값(힌트, D59).
const LAYOUTS = ['source', 'maven-war'];
const RESERVED_TOP = new Set(['src', 'web-inf', 'meta-inf']);   // 뗄 수 없는 최상위 폴더(표지 이름 — 대소문자 무시로 더 보수적으로)
// 기대 사상 — 배치 L 에서 zip 경로 → { source, compare }(두 소스가 같은 zip 경로면 null = map_conflict)
function expectedMap(layout, deployList) {
  const bySrc = new Map();
  for (const p of deployList) { const t = zipPathFor(layout, p); if (!bySrc.has(t.zip)) bySrc.set(t.zip, []); bySrc.get(t.zip).push({ source: p, compare: t.compare }); }
  const map = new Map();
  for (const [zp, list] of bySrc) map.set(zp, list.length > 1 ? null : list[0]);
  return { map, conflicts: [...bySrc].filter(([, l]) => l.length > 1) };
}
// zip 항목 → 기대 항목: 이름 그대로 먼저, 없으면(maven-war) 내부 클래스를 바깥 클래스의 존재 대조 항목으로
function lookupIn(layout, expectedZip, name) {
  if (expectedZip.has(name)) return { hit: true, exp: expectedZip.get(name) };
  const outer = layout === 'maven-war' ? findOuterClass(name, (o) => expectedZip.get(o)?.compare === 'exists') : null;
  if (outer) return { hit: true, exp: { ...expectedZip.get(outer), inner: true } };
  return { hit: false, exp: null };
}
// 공통 최상위 폴더 접두 제거(D57·R2-2·R3-1) — 래퍼 폴더 항목 `P/` 외 모든 항목(폴더 포함)이 `P/` 아래 · 파일 1개 이상 · P 가 표지 이름이 아님 · 어느 배치의 기대 경로도 `P/` 로 시작하지 않을 때만, 반복.
// 뗄 때마다 남은 이름을 정규형으로 다시 검사한다(`app/C:/…` 의 드러난 드라이브 접두) — 걸리면 { bad } (그 zip 은 대조 불가)
// 이름은 한 번만 조각으로 나누고 뗀 조각 수 d 만 늘린다 — 반복마다 이름 전체를 다시 자르지 않는다(R4-1). 최종 이름은 끝에 한 번 만든다
function stripPrefix(entries, deployList) {
  const segs = entries.map((e) => e.name.split('/'));   // 폴더 항목은 끝 조각이 ''
  const expTops = new Set(deployList.flatMap((p) => LAYOUTS.map((l) => zipPathFor(l, p).zip)).filter((z) => z.includes('/')).map((z) => z.split('/')[0]));
  const name = (i, d) => segs[i].slice(d).join('/');
  let live = entries.map((_, i) => i);   // 버린 래퍼 폴더 항목을 뺀 항목
  let d = 0;
  for (;;) {
    const top = live.length ? segs[live[0]][d] : '';
    if (!top || RESERVED_TOP.has(top.toLowerCase())) break;
    const rest = live.filter((i) => !(segs[i].length === d + 2 && segs[i][d] === top && segs[i][d + 1] === ''));   // 래퍼 폴더 항목 `top/`
    if (!rest.length || !rest.every((i) => segs[i].length > d + 1 && segs[i][d] === top) || !rest.some((i) => segs[i][segs[i].length - 1] !== '')) break;
    if (expTops.has(top)) break;
    live = rest;
    d += 1;
    // 뗄 때마다 드러난 맨 앞 조각을 다시 검사한다 — 이름 전체는 readZip 이 이미 정규형으로 검사했으므로 새로 드러날 수 있는 것은 맨 앞의 드라이브 접두뿐(R3-1)
    const bad = live.find((i) => notCanonical(segs[i][d]));
    if (bad !== undefined) return { list: live.map((i) => ({ ...entries[i], name: name(i, d) })), prefix: segs[live[0]].slice(0, d).join('/') + '/', bad: name(bad, d) };
  }
  return { list: d ? live.map((i) => ({ ...entries[i], name: name(i, d) })) : entries, prefix: d ? segs[live[0]].slice(0, d).join('/') + '/' : '', bad: null };
}
// 목록 대조(②) — 배치 L 로 이 zip 의 파일 항목을 기대와 맞춘다. 기대에 안 걸린 항목 중 접두 뗀 경로 원문이 어댑터 deploy.excludes 에 걸리면 excluded(참고 — 판정 입력 아님), 아니면 extra(1.3.4 ⑱ D72)
// maven-war 배치는 참고 분류를 하지 않는다(review-loop(impl) I-2) — WAR zip 경로는 서버에 올라가 서빙되는 경로라 저장소 경로 기준 excludes(`docs/**`·`README*`)에 걸려도 배포 제외가 아니다(웹 루트 `docs/evil.jsp` 가 「참고」로 빠져 일치가 되던 구멍)
function listCheck(layout, deployList, files, excludes) {
  const { map } = expectedMap(layout, deployList);
  const names = new Set(files.map((e) => e.name));
  const covered = new Set();
  for (const [zp, exp] of map) if (exp && names.has(zp)) covered.add(exp.source);
  const missing = [...map].filter(([zp, exp]) => exp && !names.has(zp));
  const unmatched = files.filter((e) => !lookupIn(layout, map, e.name).hit).map((e) => e.name).sort();
  const isExcluded = (n) => layout !== 'maven-war' && matchesAny(n, excludes);
  const excluded = unmatched.filter(isExcluded);
  const extra = unmatched.filter((n) => !isExcluded(n));
  return { map, covered, missing, extra, excluded };
}
// 배치 판별(D57·D58·D64) — 접두 뗀 파일 항목의 첫 조각: WEB-INF·META-INF = WAR 표지 · src = 소스 표지. 둘 다면 혼합(null), 둘 다 없으면 기대 목록 시험 → 힌트 → source
// 표지는 deploy.excludes 에 걸리지 않는 항목만으로 본다(1.3.4 D83 — WAR zip 의 src/test/** 가 소스 표지를 만들지 않게). 시험의 「불일치 0」은 excluded 를 세지 않는다
function judgeLayout(files, deployList, hint, excludes) {
  const tops = new Set(files.filter((e) => !matchesAny(e.name, excludes)).map((e) => e.name.split('/')[0]));
  const war = tops.has('WEB-INF') || tops.has('META-INF');
  const src = tops.has('src');
  if (war && src) return { layout: null, layout_source: 'signature', ambiguous: true };
  if (war || src) return { layout: war ? 'maven-war' : 'source', layout_source: 'signature' };
  const zero = LAYOUTS.filter((l) => { const c = listCheck(l, deployList, files, excludes); return c.missing.length + c.extra.length === 0; });
  if (zero.length === 1) return { layout: zero[0], layout_source: 'probe' };
  if (zero.length === 2) return { layout: 'source', layout_source: 'probe' };
  return { layout: hint.layout, layout_source: hint.source };
}

export function deploy({ adapter, work }) {
  const mr = JSON.parse(fs.readFileSync(path.join(work, 'mr.json'), 'utf8'));
  const snap = JSON.parse(fs.readFileSync(path.join(work, 'snapshot.json'), 'utf8'));
  const check = JSON.parse(fs.readFileSync(path.join(work, 'check.json'), 'utf8'));
  const keep = knownShas({ mr, snapshot: snap });
  const excludes = adapter.deploy?.excludes || [];
  const hintKey = adapter.projects?.[mr.project?.name]?.deployLayout;
  const hint = { layout: hintKey || adapter.resolved?.projects?.[mr.project?.name]?.deployLayout || 'source', source: hintKey ? 'adapter' : 'default' };
  const out = { applicable: false, reason: null, expected: { deploy: [], deleted: [] }, zip: { attachment: null, downloaded: false, comment_sha: null, entries: [], bytes_source: null, layout: hint.layout, layout_source: hint.source, prefix: null, bytes_skipped: [], excluded: [] }, zips: [], bodyDeletedList: parseDeletedList(mr.description || ''), result: '해당 없음', mismatches: [] };
  const exempt = check.deployExempt === true || mr.project?.deployExempt === true;
  if (exempt) { out.reason = '어댑터 배포 제외 프로젝트'; return finish(work, out); }
  out.expected = expectedLists({ adapter, mr, snap });
  if (out.expected.deploy.length + out.expected.deleted.length === 0) {
    // 기대 변경이 없어도 본문에 삭제 목록이 있으면 비해당으로 끝내지 않는다(R4-2) — zip 단계는 건너뛰고 ④ 만 돌려 「기대에 없는 삭제 지시」를 불일치로 판정에 전달한다(배포자가 본문대로 정상 파일을 지우는 경로 차단)
    if (out.bodyDeletedList.length === 0) { out.reason = '운영 배포 대상 변경 없음'; return finish(work, out); }
    out.reason = '운영 배포 대상 변경 없음 — 본문 삭제 목록만 대조(④)';
  }
  out.applicable = true;
  const mm = out.mismatches;
  // 같은 (kind·path·detail) 는 한 번만 — 이미 쌓인 항목을 집합으로 따라잡아 대조한다(목록 전체를 매번 훑지 않는다 — R3-1)
  const seenMm = new Set();
  let scannedMm = 0;
  const mmKey = (x) => `${x.kind}\0${x.path}\0${x.detail}`;
  const push = (m) => {
    if (m.path !== null) {
      for (; scannedMm < mm.length; scannedMm++) if (mm[scannedMm].path !== null) seenMm.add(mmKey(mm[scannedMm]));
      if (seenMm.has(mmKey(m))) return;
    }
    mm.push(m);
  };
  const dl = out.expected.deploy;
  let judged = [];   // 배치가 정해진 zip(②③ 대조 대상)

  if (dl.length > 0) {
    // 본문 zip 전부(D60 — 같은 링크는 한 번), 없으면 댓글 zip 중 마지막 1개
    const all = (check.attachments || []).filter((a) => a.kind === 'zip');
    const seen = new Set();
    const body = all.filter((a) => a.where === 'body').filter((a) => { const k = `${a.secret}/${a.filename}`; if (seen.has(k)) return false; seen.add(k); return true; });
    const atts = body.length ? body : all.slice(-1);
    if (!atts.length) { out.result = 'zip 누락'; }
    else {
      const many = atts.length > 1;
      // zip 식별 표기 — 1개면 지금처럼(파일명 없이·파일명만), 여럿이면 `zip#<순번> <파일명>`
      const lab = (i) => (many ? `zip#${i + 1} ${showText(atts[i].filename)}` : `zip ${showText(atts[i].filename)}`);
      const tag = (i, detail) => (many ? `${lab(i)}: ${detail}` : detail);
      const zs = atts.map((att, i) => {
        const zr = { attachment: showText(att.filename), downloaded: false, comment_sha: null, entries: [], layout: null, layout_source: null, prefix: null, bytes_skipped: [], excluded: [] };
        const st = { i, zr, z: null, files: [], all: [], commentOk: false, hasComment: false };
        const name = uploadName(att);
        let buf = null;
        if (!name) { mm.push({ kind: 'download', path: null, detail: tag(i, `첨부 파일명·경로가 안전하지 않아 조회하지 않음: ${showName(String(att.filename).slice(0, 120))}`) }); return st; }
        try {
          buf = apiRaw(`projects/${mr.project.id}/uploads/${att.secret}/${encodeURIComponent(name)}`);
          fs.mkdirSync(path.join(work, 'zip'), { recursive: true });
          fs.writeFileSync(path.join(work, 'zip', many ? `${i + 1}-${name}` : name), buf);   // 같은 파일명 zip 둘을 덮어쓰지 않게 순번 접두(AC⑬-15)
          zr.downloaded = true;
        } catch (e) {
          mm.push({ kind: 'download', path: null, detail: tag(i, `다운로드 실패: ${e.message.slice(0, 160)}`) });
          return st;
        }
        try { st.z = readZip(buf); } catch (e) { mm.push({ kind: 'corrupt', path: null, detail: tag(i, `zip 판독 실패: ${e.message}`) }); return st; }
        // 주석 = SHA 또는 null(1.3.4 S2 — spec 2026-10-23 3.S2-2 D73) — 원문은 deploy.json·리포트 어디에도 적지 않는다(길이만). SHA 후보는 가린 주석에서 뽑는다(D89 — `token=<16진>` 이 문맥 없이 저장되지 않게, 실제 커밋 SHA 는 keep 으로 보호)
        const cmt = st.z.comment.trim();
        const cm = cmt ? maskText(cmt, adapter.mask, keep).match(/[0-9a-f]{7,40}/) : null;
        zr.comment_sha = cm ? cm[0] : null;
        st.commentLen = cmt.length;
        st.hasComment = cmt !== '';
        st.commentOk = !!cm && snap.head_sha.startsWith(cm[0]);
        const sp = stripPrefix(st.z.entries, dl);
        zr.prefix = sp.prefix;
        if (sp.bad) { mm.push({ kind: 'corrupt', path: null, detail: `${lab(i)}: 접두 ${sp.prefix} 를 떼자 정규형이 아닌 이름이 드러남(절대·드라이브 접두·역슬래시·빈 조각·./..): ${sp.bad}` }); st.z = null; return st; }
        st.all = sp.list;
        st.files = sp.list.filter((e) => !e.name.endsWith('/'));
        zr.entries = st.files.map((e) => e.name).sort();
        const j = judgeLayout(st.files, dl, hint, excludes);
        zr.layout_source = j.layout_source;
        if (j.ambiguous) { mm.push({ kind: 'layout_ambiguous', path: null, detail: `${lab(i)}: WAR 표지(WEB-INF/·META-INF/)와 소스 표지(src/)가 함께 있음 — 배치를 정할 수 없음` }); return st; }
        zr.layout = j.layout;
        st.layout = j.layout;
        return st;
      });
      const read = zs.filter((st) => st.z);
      judged = read.filter((st) => st.layout);
      // ① 주석 SHA — zip 1개면 현행(주석 없음 = 불일치), 여럿이면 「최소 한 zip」(D63): 일치하는 zip 이 있으면 주석이 있는데 다른 zip 만 불일치, 없으면 불일치 1건
      // 주석 상태 표기(D73) — SHA · (없음) · SHA 없음(n자)
      const cstate = (st) => st.zr.comment_sha ?? (st.hasComment ? `SHA 없음(${st.commentLen}자)` : '(없음)');
      const csent = (st) => (st.zr.comment_sha === null && st.hasComment ? `zip 주석에 SHA 없음(주석 ${st.commentLen}자)` : `zip 주석 ${cstate(st)}`);
      if (!many) { for (const st of read) if (!st.commentOk) mm.push({ kind: 'comment_sha', path: null, detail: `${csent(st)} ≠ head ${snap.head_sha}` }); }
      else if (read.length) {
        if (read.some((st) => st.commentOk)) { for (const st of read) if (st.hasComment && !st.commentOk) mm.push({ kind: 'comment_sha', path: null, detail: `${lab(st.i)}: ${csent(st)} ≠ head ${snap.head_sha}` }); }
        else mm.push({ kind: 'comment_sha', path: null, detail: `head 와 일치하는 zip 주석 없음 — ${read.map((st) => `${lab(st.i)} 주석 ${cstate(st)}`).join(' · ')} ≠ head ${snap.head_sha}` });
      }
      // 기대 사상(배치별) — 두 소스가 같은 zip 경로로 사상되면 어느 원문과 비교할지 정할 수 없어 map_conflict(대조 불가 — fail-closed)
      const maps = new Map();
      for (const st of judged) if (!maps.has(st.layout)) { const em = expectedMap(st.layout, dl); maps.set(st.layout, em.map); for (const [zp, list] of em.conflicts) push({ kind: 'map_conflict', path: zp, detail: `소스 두 경로가 같은 배포 경로로 사상됨: ${list.map((x) => x.source).join(', ')}` }); }
      // ② 목록 — 기대 경로는 어느 zip 에서든 충족(D60). 대조하지 못한 zip(손상·혼합·다운로드 실패)이 있으면 그 zip 에 있었을 경로를 「누락」으로 단정하지 않는다
      const checks = judged.map((st) => ({ st, c: listCheck(st.layout, dl, st.files, excludes) }));
      for (const { st, c } of checks) st.zr.excluded = c.excluded;
      if (judged.length === zs.length) {
        const covered = new Set(checks.flatMap(({ c }) => [...c.covered]));
        const layouts = [...new Set(judged.map((st) => st.layout))];
        for (const p of dl) {
          if (covered.has(p)) continue;
          const zps = [...new Set(layouts.filter((l) => maps.get(l).get(zipPathFor(l, p).zip)).map((l) => zipPathFor(l, p).zip))];
          if (!zps.length) continue;   // map_conflict 경로
          mm.push({ kind: 'missing_in_zip', path: p, detail: zps.length === 1 && zps[0] === p ? '배포 목록에 있으나 zip 에 없음' : `배포 목록에 있으나 zip 에 없음(기대 경로 ${zps.join(' · ')})` });
        }
      }
      for (const { st, c } of checks) for (const n of c.extra) mm.push({ kind: 'extra_in_zip', path: n, detail: tag(st.i, 'zip 에 있으나 배포 목록에 없음') });
      // zip 사이 충돌(여럿일 때만 — 한 zip 안은 readZip 이 거부) — (가) 같은 키(끝 `/` 뗀 소문자)인데 둘 다 폴더도, 이름이 정확히 같은 파일 둘도 아님 (나) 한 zip 의 파일 키가 다른 zip 항목 키의 상위 조각(R1-2)
      const handled = new Set();   // 같은 경로가 여러 zip 에 있을 때 대조는 첫 zip 의 항목으로 한 번만(D60)
      if (many) {
        const keyed = new Map();
        const fileKeys = new Map();
        for (const st of read) for (const e of st.all) {
          const key = e.name.replace(/\/$/, '').toLowerCase();
          if (!keyed.has(key)) keyed.set(key, []);
          keyed.get(key).push({ st, e });
          if (!e.name.endsWith('/')) { if (!fileKeys.has(key)) fileKeys.set(key, []); fileKeys.get(key).push({ st, e }); }
        }
        const conflict = (a, b) => push({ kind: 'zip_conflict', path: b.e.name, detail: `${lab(a.st.i)} 의 ${a.e.name} 와 ${lab(b.st.i)} 의 ${b.e.name} 가 풀 때 충돌(대소문자·파일/폴더) — 함께 배포할 수 없음` });
        // 충돌은 경로(키)마다 대표 1건만 — zip 쌍마다 쌓으면 작은 zip 여러 개로 기록이 zip 수의 제곱으로 는다(R3-1)
        const clash = (a, b) => {
          if (a.st === b.st) return false;
          const dirA = a.e.name.endsWith('/');
          const dirB = b.e.name.endsWith('/');
          if (dirA && dirB) return false;
          return !(!dirA && !dirB && a.e.name === b.e.name);   // 같은 이름 파일 둘은 같은 경로 규칙(아래)
        };
        // 한 zip 안에서 같은 키는 readZip 이 거부하므로 목록의 항목은 모두 다른 zip 것이다 — 첫 항목이 누구와도 충돌하지 않으면 나머지는 전부 폴더이거나 전부 같은 이름 파일이라 충돌이 없다. 첫 항목과만 비교한다(R5-1)
        for (const list of keyed.values()) {
          const b = list.find((y, i) => i > 0 && clash(list[0], y));
          if (b) conflict(list[0], b);
        }
        const under = new Set();   // (나) 하위 항목 키마다 1건
        for (const st of read) for (const e of st.all) {
          const key = e.name.replace(/\/$/, '').toLowerCase();
          if (under.has(key)) continue;
          const segs = key.split('/');
          for (let k = 1; k < segs.length; k++) {
            const f = (fileKeys.get(segs.slice(0, k).join('/')) || []).find((x) => x.st !== st);
            if (f) { conflict(f, { st, e }); under.add(key); break; }
          }
        }
        // 같은 zip 경로 다른 바이트 = zip_conflict(존재 대조 항목 .class 포함 — D66). 같은 바이트면 첫 zip 의 항목으로 한 번만 대조한다
        const byName = new Map();
        for (const st of judged) for (const e of st.files) { if (!byName.has(e.name)) byName.set(e.name, []); byName.get(e.name).push({ st, e }); }
        for (const [n, list] of byName) {
          if (list.length < 2) continue;
          // 기준(첫 zip) 버퍼와 현재 버퍼만 들고 바로 비교한다 — zip 수만큼 풀린 내용을 쌓지 않는다(R2-1)
          let base = null;
          list.forEach((it, x) => {
            let cur = null;
            try { cur = it.st.z.read(it.e); } catch (err) { push({ kind: 'corrupt', path: n, detail: tag(it.st.i, err.message) }); }
            if (x === 0) base = cur;
            else if (base && cur && !base.equals(cur)) push({ kind: 'zip_conflict', path: n, detail: `${lab(list[0].st.i)} 와 ${lab(it.st.i)} 의 같은 경로 내용이 다름 — 어느 쪽이 배포될지 정할 수 없음` });
          });
          for (const it of list.slice(1)) handled.add(it.e);
        }
      }
      // ③ 항목별 대조 — 컴파일 산출물(compare: exists)은 일반 파일인지만 보고 바이트·git 유형 대조는 건너뛴다(D38, 판독(CRC)은 한다). bytes_skipped 는 그 소스가 어느 zip 에서도 바이트 대조되지 않은 것만(D60)
      const skippedBy = new Map();
      const compared = new Set();
      out.zip.bytes_source = read.length ? (snap.mode === 'worktree' ? 'worktree' : 'blobs') : null;
      const headRoot = path.join(work, 'blobs', 'head');
      const unrecovered = new Set(snap.unrecovered || []);
      for (const { st } of checks) {
        const map = maps.get(st.layout);
        const skipped = [];
        const toCompare = [];
        for (const e of st.files) {
          const dup = handled.has(e);   // 같은 바이트의 뒤 zip 항목 — 유형 검사는 항목마다 하고 바이트 대조만 한 번(R1-1)
          const { exp } = lookupIn(st.layout, map, e.name);
          if (!exp) continue;
          if (exp.compare === 'exists') {
            if (e.type !== 'file') { mm.push({ kind: 'type', path: e.name, detail: tag(st.i, `컴파일 산출물 zip 항목 유형 ${e.type} — 일반 파일만 인정`) }); continue; }
            if (dup) continue;
            try { st.z.read(e); } catch (err) { mm.push({ kind: 'corrupt', path: e.name, detail: tag(st.i, err.message) }); continue; }
            skipped.push({ name: e.name, source: exp.source });
          } else toCompare.push({ e, src: exp.source, dup });
        }
        skippedBy.set(st, skipped);
        for (const { e, src, dup } of toCompare) {
          compared.add(src);
          if (snap.mode === 'worktree') {
            const gt = gitType(snap.checkout, snap.head_sha, src);
            if (e.type !== gt) { mm.push({ kind: 'type', path: src, detail: tag(st.i, `zip 항목 유형 ${e.type} ≠ head 의 git 유형 ${gt}`) }); continue; }
            if (dup) continue;
            let zb;
            try { zb = st.z.read(e); } catch (err) { mm.push({ kind: 'corrupt', path: src, detail: tag(st.i, err.message) }); continue; }
            const gb = gitShow(snap.checkout, snap.head_sha, src);
            if (!gb || !gb.equals(zb)) mm.push({ kind: 'bytes', path: src, detail: tag(st.i, `git show ${snap.head_sha.slice(0, 7)}:${src} 와 바이트 불일치`) });
          } else {
            // diff-only(1.3.1 ③ — spec 2026-10-22 3.③) — collect 가 받은 head 원문 `W/blobs/head/` 와 대조한다. 유형은 zip 쪽만 본다(일반 파일만 대조 — tree API 유형 대조는 안 함, D22).
            // 원문을 못 받은 경로(unrecovered·blob 없음)는 경로별 대조 불가. blob 경로는 복원 루트 안으로만 해소한다(경로는 소스 경로 — 1.3.2 ⑨ 매핑 뒤에도 같다)
            if (e.type !== 'file') { mm.push({ kind: 'type', path: src, detail: tag(st.i, `diff-only — zip 항목 유형 ${e.type} 확인 불가(일반 파일만 대조)`) }); continue; }
            if (dup) continue;
            const blob = insideRoot(headRoot, src);
            if (unrecovered.has(src) || !blob || !fs.lstatSync(blob, { throwIfNoEntry: false })?.isFile()) { push({ kind: 'bytes_unavailable', path: src, detail: 'head 원문 미확보 — 바이트 대조 불가' }); continue; }
            let zb;
            try { zb = st.z.read(e); } catch (err) { mm.push({ kind: 'corrupt', path: src, detail: tag(st.i, err.message) }); continue; }
            if (!fs.readFileSync(blob).equals(zb)) mm.push({ kind: 'bytes', path: src, detail: tag(st.i, `blobs/head/${src}와 바이트 불일치`) });
          }
        }
      }
      for (const [st, list] of skippedBy) st.zr.bytes_skipped = list.filter((x) => !compared.has(x.source)).map((x) => x.name).sort();
      // 합산 요약(SC-3 zip — 기존 소비자 불변) + zip 별 상세 zips[]
      out.zips = zs.map((st) => st.zr);
      out.zip.attachment = atts.map((a) => showText(a.filename)).join(', ');
      out.zip.downloaded = zs.every((st) => st.zr.downloaded);
      out.zip.comment_sha = many ? (read.find((st) => st.commentOk)?.zr.comment_sha ?? null) : zs[0].zr.comment_sha;
      out.zip.entries = [...new Set(zs.flatMap((st) => st.zr.entries))].sort();
      out.zip.bytes_skipped = [...new Set(zs.flatMap((st) => st.zr.bytes_skipped))].sort();
      out.zip.excluded = [...new Set(zs.flatMap((st) => st.zr.excluded))].sort();
      out.zip.prefix = many ? null : zs[0].zr.prefix;
      if (judged.length) {
        const ls = new Set(judged.map((st) => st.layout));
        const ss = new Set(judged.map((st) => st.zr.layout_source));
        out.zip.layout = ls.size === 1 ? [...ls][0] : 'mixed';
        out.zip.layout_source = ls.size === 1 && ss.size === 1 ? [...ss][0] : 'mixed';
      }
    }
  }
  // ④ 삭제 목록의 정규화 배치 L4(D59·D60) — 대조한 zip 중 하나라도 maven-war 면 maven-war(WAR·소스 꼴 표기 모두 수용), 전부 source 면 source, 대조한 zip 이 없으면(삭제 전용·zip 누락·혼합뿐) 어댑터 힌트
  const layout = judged.length ? (judged.some((st) => st.layout === 'maven-war') ? 'maven-war' : 'source') : hint.layout;
  // ④ 삭제 목록은 기대가 비어 있어도 항상 집합 비교(순서 무관) — 본문에만 있는 삭제 지시(기대에 없는 경로)는 배포자가 정상 파일을 지우게 하므로 불일치다.
  // 1.3.2 ⑨ — 양쪽을 zip 경로로 정규화(소스 접두는 매핑 · 이미 zip 경로 꼴은 그대로)한 뒤 비교한다. detail 에는 원문을 적는다.
  // 내부 클래스(maven-war)는 ② 와 같은 2단계 — 본문 이름 그대로 먼저, 없을 때만 삭제한 .java 의 산출물(compare: exists)인 바깥 클래스로 본다(`$` 든 리소스·`Foo$Bar.java` 의 고유 이름을 합치지 않는다 — R1-1)
  {
    const expMapped = out.expected.deleted.map((p) => zipPathFor(layout, p));
    const expDel = new Set(expMapped.map((t) => t.zip));
    const expClasses = new Set(expMapped.filter((t) => t.compare === 'exists').map((t) => t.zip));
    // 내부 클래스는 바깥 클래스 삭제가 본문에 따로 있을 때만 그 추가 삭제로 접는다 — 내부 클래스만 적으면 바깥 .class 가 서버에 남는다(R4-2, 추천 자동 채택(위임))
    const bodyZip = new Set(out.bodyDeletedList.map((p) => zipPathFor(layout, p).zip));
    // 접기 전 head 트리 조회(1.3.3 S1 — spec 2026-10-23 3.S1 D61) — 본문의 `Foo$X.class` 가 내부 클래스 산출물이 아니라 head 에 살아 있는 다른 파일(리소스·살아 있는 소스의 산출물)이면 접지 않고 map_conflict(대조 불가).
    // 후보 = 역사상 고정 5 + `$` 경계 전부(위치 0 포함 — review-loop(impl) R1-2)의 바깥 소스 .java(R1-1·R2-1). head 목록은 `ls-tree -r -z`(NUL 구분 — quotePath 인용 없음, C1-N1) 1회 캐시, 대소문자 무시 비교(R5-1). diff-only 는 트리 조회를 하지 않고 대조 불가(D22)
    let headTree = null;
    const headHit = (zp) => {
      if (!headTree) { headTree = new Map(); for (const p of gitZ(snap.checkout, ['ls-tree', '-r', '-z', '--name-only', snap.head_sha])) { const k = p.toLowerCase(); if (!headTree.has(k)) headTree.set(k, p); } }
      const cands = [`src/main/webapp/${zp}`, zp];
      if (zp.startsWith(WAR_CLASSES)) {
        const rest = zp.slice(WAR_CLASSES.length);
        const m = rest.match(/^(.*\/)?([^/]+)\.class$/);
        cands.push(`src/main/resources/${rest}`, `src/main/java/${rest}`);
        if (m) {
          const dir = m[1] || '';
          cands.push(`src/main/java/${dir}${m[2]}.java`);
          for (let k = m[2].indexOf('$'); k >= 0; k = m[2].indexOf('$', k + 1)) cands.push(`src/main/java/${dir}${m[2].slice(0, k)}.java`);
        }
      }
      return [...new Set(cands.map((c) => headTree.get(c.toLowerCase())).filter(Boolean))];
    };
    const normBody = (p) => {
      const zp = zipPathFor(layout, p).zip;
      if (expDel.has(zp)) return zp;
      const outer = layout === 'maven-war' ? findOuterClass(zp, (o) => expClasses.has(o) && bodyZip.has(o)) : null;
      if (!outer) return zp;
      if (snap.mode !== 'worktree') { push({ kind: 'map_conflict', path: zp, detail: 'head 존재 확인 불가(diff-only) — 내부 클래스 삭제 지시를 확인할 수 없음' }); return zp; }
      const hits = headHit(zp);
      if (hits.length) { push({ kind: 'map_conflict', path: zp, detail: `삭제 지시가 head 의 실제 파일을 가리킴: ${hits.join(', ')}` }); return zp; }
      return outer;
    };
    // 배포 소스와 삭제 소스가 같은 zip 경로로 사상되면(소스 이동 resources → java 등) 삭제 지시가 새로 배포한 파일을 지운다 — map_conflict(대조 불가 — fail-closed, R2-1)
    const deployBy = new Map();
    for (const p of out.expected.deploy) { const zp = zipPathFor(layout, p).zip; if (!deployBy.has(zp)) deployBy.set(zp, []); deployBy.get(zp).push(p); }
    for (const [i, t] of expMapped.entries()) if (deployBy.has(t.zip)) mm.push({ kind: 'map_conflict', path: t.zip, detail: `소스 두 경로가 같은 배포 경로로 사상됨: ${deployBy.get(t.zip).join(', ')}, ${out.expected.deleted[i]}(삭제)` });
    // 삭제 목록(기대·본문 — zip 경로로 사상, 내부 클래스 폴백 없이 이름 그대로)의 경로가 zip 항목에도 있으면 배포 뒤 삭제가 방금 배포한 파일을 지운다 — 경우별이 아니라 이 한 규칙으로 막는다(R3-1, 추천 자동 채택(위임))
    const inZipEntries = new Set(out.zip.entries);
    const delZip = new Map();
    for (const p of [...out.expected.deleted, ...out.bodyDeletedList]) { const zp = zipPathFor(layout, p).zip; if (!delZip.has(zp)) delZip.set(zp, []); if (!delZip.get(zp).includes(p)) delZip.get(zp).push(p); }
    // 매핑한 경로(배포·기대 삭제·본문 삭제)가 정규형이 아니면 zip 유무와 무관하게 대조 불가 — 접두를 떼며 드러난 `C:/…`·`..\…` 를 정상 배포·삭제 지시로 보증하지 않는다(R5-1, 추천 자동 채택(위임))
    for (const p of [...out.expected.deploy, ...out.expected.deleted, ...out.bodyDeletedList]) {
      const zp = zipPathFor(layout, p).zip;
      if (notCanonical(zp) && !mm.some((m) => m.kind === 'map_conflict' && m.path === zp)) mm.push({ kind: 'map_conflict', path: zp, detail: `사상한 배포 경로가 정규형이 아님(절대·드라이브 접두·역슬래시·빈 조각·./..): ${p}` });
    }
    for (const [zp, srcs] of delZip) if (inZipEntries.has(zp) && !mm.some((m) => m.kind === 'map_conflict' && m.path === zp)) mm.push({ kind: 'map_conflict', path: zp, detail: `삭제 목록의 경로가 zip 에도 들어 있음 — 배포 뒤 삭제하면 방금 배포한 파일이 지워진다: ${srcs.join(', ')}` });
    const bodyDel = new Set(out.bodyDeletedList.map(normBody));
    const same = expDel.size === bodyDel.size && [...expDel].every((p) => bodyDel.has(p));
    if (!same) mm.push({ kind: 'deleted_list', path: null, detail: `삭제 목록 불일치 — 기대 [${out.expected.deleted.join(', ') || '없음'}] / 본문 [${out.bodyDeletedList.join(', ') || '없음'}]` });
  }
  if (out.result !== 'zip 누락') {
    if (mm.some((m) => m.kind === 'download' || m.kind === 'corrupt' || m.kind === 'bytes_unavailable' || m.kind === 'map_conflict' || m.kind === 'layout_ambiguous' || m.kind === 'zip_conflict')) out.result = '대조 불가';
    else out.result = mm.length ? '불일치' : '일치';
  }
  return finish(work, out);
}

function finish(work, out) {
  fs.writeFileSync(path.join(work, 'deploy.json'), JSON.stringify(out, null, 2));
  return out;
}

export async function cmdDeploy(args, ctx) {
  const d = deploy({ adapter: ctx.adapter, work: ctx.work });
  return `DEPLOY ${d.result}`;
}
