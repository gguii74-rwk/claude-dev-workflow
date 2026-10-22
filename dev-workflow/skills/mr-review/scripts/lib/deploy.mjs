// deploy.mjs — spec §5.2b. 기대 목록(4.7 규칙·--no-renames) → zip 다운로드 → ①주석 SHA ②목록 ③바이트 ④삭제 목록 대조. 모델 없이.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { apiRaw } from './gitlab.mjs';
import { matchesAny } from './adapter.mjs';
import { insideRoot } from './collect.mjs';

const MAX_BUFFER = 512 * 1024 * 1024;
const MAX_ENTRY = 256 * 1024 * 1024;   // 항목 하나의 비압축 상한(압축 폭탄 — impl SDD 이월 T04①). 소스·리소스 배포본 범위

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

// 내부 클래스 산출물 → 바깥 클래스 후보, 긴 것부터(`Foo$Bar$1.class` → `Foo$Bar.class`, `Foo.class` — `Foo$Bar.java` 의 산출물도 찾게, R2-2). .class 가 아니거나 `$` 가 없으면 []
function outerClasses(name) {
  const m = name.match(/^(.*\/)?([^/]+)\.class$/);
  if (!m) return [];
  const segs = m[2].split('$');
  const out = [];
  for (let i = segs.length - 1; i >= 1; i--) { const base = segs.slice(0, i).join('$'); if (base) out.push(`${m[1] || ''}${base}.class`); }
  return out;
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
function zipName(raw, flags) {
  if (!(flags & 0x0800) && raw.some((b) => b >= 0x80)) throw new Error(`zip 파일명이 UTF-8 표시 없이 비ASCII(표준 리더와 이름이 달라짐): ${raw.toString('latin1')}`);
  let name;
  try { name = UTF8.decode(raw); } catch { throw new Error(`zip 파일명이 올바른 UTF-8 이 아님: ${raw.toString('latin1')}`); }
  // 왕복 대조(impl R4-4) — 해독기가 몰래 바꾼 이름(앞 BOM 제거 등)은 다른 리더와 이름이 갈린다
  if (!Buffer.from(name, 'utf8').equals(raw)) throw new Error(`zip 파일명이 UTF-8 왕복에서 바뀜(BOM 등): ${raw.toString('latin1')}`);
  // 제어문자(impl R5-2) — NUL 에서 이름을 자르는 리더는 `x.js\0/`(우리에겐 폴더)를 일반 파일 `x.js` 로 푼다
  if (/[\u0000-\u001f\u007f]/.test(name)) throw new Error(`zip 파일명에 제어문자(NUL 등): ${JSON.stringify(name)}`);
  // 정규형만(impl R6-3 훅) — 앞 `/`·역슬래시·빈 조각·`.`·`..` 는 해제 도구가 경로를 정리하며 다른 위치·충돌을 만든다(git archive 이름은 항상 정규형)
  // 드라이브 접두(`C:/…`·`C:…` — 1.3.2 R4-1)도 절대·드라이브 상대 경로라 Windows 해제 도구가 배포 루트 밖을 가리킨다(maven-war 웹 루트 매핑이 `src/main/webapp/C:/…` 를 그 이름으로 만든다)
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name) || name.includes('\\') || name.replace(/\/$/, '').split('/').some((s) => s === '' || s === '.' || s === '..')) throw new Error(`zip 파일명이 정규형이 아님: ${JSON.stringify(name)}`);
  return name;
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
  // 푸는 내용이라 「일치」로 보증하지 않는다. data descriptor(bit 3)는 레코드 끝을 local 헤더로 확정할 수 없어 여기서 거부한다(git archive 는 쓰지 않음 — impl R4-1 실측).
  let at = 0;
  for (const e of [...entries].sort((a, b) => a.lho - b.lho)) {
    if (e.lho !== at) throw new Error(`zip 레이아웃 불일치 — 목차에 없는 데이터 또는 겹침(오프셋 ${at} ≠ 항목 시작 ${e.lho}): ${e.name}`);
    if (e.flags & 0x0008) throw new Error(`zip data descriptor(bit 3) 항목(미지원): ${e.name}`);
    if (at + 30 > cdOff || buf.readUInt32LE(at) !== 0x04034b50) throw new Error(`zip local header 손상: ${e.name}`);
    // 모든 항목(폴더 포함)의 local 헤더를 목차와 먼저 대조한다(8b FR2-1, 추천 자동 채택(위임)) — 폴더는 read() 를 거치지 않으므로, 목차엔 빈 폴더 `padding/` · local 엔 `evil.jsp` + 내용인
    // 항목이 순차 리더에서만 파일로 풀린다. 이름(원시 바이트)·플래그·압축 방식·CRC·두 크기가 같아야 하고, 폴더는 두 크기가 0 이어야 한다.
    const lnLen = buf.readUInt16LE(at + 26);
    const leLen = buf.readUInt16LE(at + 28);
    if (!buf.subarray(at + 30, at + 30 + lnLen).equals(e.raw)) throw new Error(`zip local header 파일명 불일치: ${e.name}`);
    if (buf.readUInt16LE(at + 6) !== e.flags || buf.readUInt16LE(at + 8) !== e.method) throw new Error(`zip local header 플래그·압축 방식 불일치: ${e.name}`);
    if (buf.readUInt32LE(at + 14) !== e.crc || buf.readUInt32LE(at + 18) !== e.csize || buf.readUInt32LE(at + 22) !== e.usize) throw new Error(`zip local header CRC·크기 불일치(목차와 다름): ${e.name}`);
    if (e.name.endsWith('/') && e.csize !== 0) throw new Error(`zip 폴더 항목에 데이터가 있음(${e.csize}바이트): ${e.name}`);
    // 허용 검증은 모든 항목(폴더 포함)에 공통(8b FR3-4, 추천 자동 채택(위임)) — read() 를 거치지 않는 폴더도 암호화·미지원 압축 방식·CRC 있는 빈 폴더면 표준 리더가 거부하는 zip 이다
    if (e.flags & 0x0041) throw new Error(`zip 암호화 플래그(미지원): ${e.name}`);
    if (e.method !== 0 && e.method !== 8) throw new Error(`지원하지 않는 압축 방식(${e.method}): ${e.name}`);
    if (e.name.endsWith('/') && e.crc !== 0) throw new Error(`zip 폴더 항목에 CRC 가 있음(${e.crc.toString(16)}): ${e.name}`);
    checkExtra(buf, at + 30 + lnLen, leLen, e.name, 'local');
    at += 30 + lnLen + leLen + e.csize;
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
    // local 크기·CRC 대조(impl R4-1) — 표준 리더는 local 값으로 풀 수 있어 목차와 다르면 다른 바이트가 나온다. data descriptor(bit 3)는 local 값이 비어 경계를 확정할 수 없어 거부(git archive 는 쓰지 않음 — 실측)
    if (e.flags & 0x0008) throw new Error(`zip data descriptor(bit 3) 항목(미지원): ${e.name}`);
    if (buf.readUInt32LE(h + 14) !== e.crc) throw new Error(`zip local header CRC 불일치(목차와 다름): ${e.name}`);
    if (buf.readUInt32LE(h + 18) !== e.csize || buf.readUInt32LE(h + 22) !== e.usize) throw new Error(`zip local header 크기 불일치(목차와 다름): ${e.name}`);
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
  if (!name || name === '.' || name === '..' || /[\/\\\0]/.test(name) || !/^[0-9a-f]{32}$/.test(String(att.secret || ''))) return null;
  return name;
}

function gitShow(cwd, sha, p) {
  const r = spawnSync('git', ['-C', cwd, 'show', `${sha}:${p}`], { maxBuffer: MAX_BUFFER });
  if (r.status !== 0) return null;
  return r.stdout;
}

export function deploy({ adapter, work }) {
  const mr = JSON.parse(fs.readFileSync(path.join(work, 'mr.json'), 'utf8'));
  const snap = JSON.parse(fs.readFileSync(path.join(work, 'snapshot.json'), 'utf8'));
  const check = JSON.parse(fs.readFileSync(path.join(work, 'check.json'), 'utf8'));
  const layout = adapter.resolved?.projects?.[mr.project?.name]?.deployLayout || 'source';
  const out = { applicable: false, reason: null, expected: { deploy: [], deleted: [] }, zip: { attachment: null, downloaded: false, comment_sha: null, entries: [], bytes_source: null, layout, bytes_skipped: [] }, bodyDeletedList: parseDeletedList(mr.description || ''), result: '해당 없음', mismatches: [] };
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

  if (out.expected.deploy.length > 0) {
    const zips = (check.attachments || []).filter((a) => a.kind === 'zip');
    const att = zips.filter((a) => a.where === 'body').pop() || zips.pop() || null;
    if (!att) { out.result = 'zip 누락'; }
    else {
      out.zip.attachment = att.filename;
      let buf = null;
      const name = uploadName(att);
      if (!name) mm.push({ kind: 'download', path: null, detail: `첨부 파일명·경로가 안전하지 않아 조회하지 않음: ${String(att.filename).slice(0, 120)}` });
      else {
        try {
          buf = apiRaw(`projects/${mr.project.id}/uploads/${att.secret}/${encodeURIComponent(name)}`);
          fs.mkdirSync(path.join(work, 'zip'), { recursive: true });
          fs.writeFileSync(path.join(work, 'zip', name), buf);
          out.zip.downloaded = true;
        } catch (e) {
          mm.push({ kind: 'download', path: null, detail: `다운로드 실패: ${e.message.slice(0, 160)}` });
        }
      }
      let z = null;
      if (buf) {
        try { z = readZip(buf); } catch (e) { mm.push({ kind: 'corrupt', path: null, detail: `zip 판독 실패: ${e.message}` }); }
      }
      if (z) {
        const cm = z.comment.trim().match(/[0-9a-f]{7,40}/);
        out.zip.comment_sha = cm ? cm[0] : (z.comment.trim() || null);
        if (!cm || !snap.head_sha.startsWith(cm[0])) mm.push({ kind: 'comment_sha', path: null, detail: `zip 주석 ${out.zip.comment_sha ?? '(없음)'} ≠ head ${snap.head_sha}` });
        const files = z.entries.filter((e) => !e.name.endsWith('/'));
        out.zip.entries = files.map((e) => e.name).sort();
        // 기대 사상(1.3.2 ⑨) — zip 경로 → { source, compare }. 두 소스가 같은 zip 경로로 사상되면 어느 원문과 비교할지 정할 수 없어 map_conflict(대조 불가 — fail-closed)
        const bySrc = new Map();
        for (const p of out.expected.deploy) { const t = zipPathFor(layout, p); if (!bySrc.has(t.zip)) bySrc.set(t.zip, []); bySrc.get(t.zip).push({ source: p, compare: t.compare }); }
        const expectedZip = new Map();
        for (const [zp, list] of bySrc) {
          if (list.length > 1) { mm.push({ kind: 'map_conflict', path: zp, detail: `소스 두 경로가 같은 배포 경로로 사상됨: ${list.map((x) => x.source).join(', ')}` }); expectedZip.set(zp, null); }
          else expectedZip.set(zp, list[0]);
        }
        // zip 항목 → 기대 항목: 이름 그대로 먼저, 없으면(maven-war) 내부 클래스를 바깥 클래스의 존재 대조 항목으로
        const lookup = (name) => {
          if (expectedZip.has(name)) return { hit: true, exp: expectedZip.get(name) };
          const outer = layout === 'maven-war' ? outerClasses(name).find((o) => expectedZip.get(o)?.compare === 'exists') : null;
          if (outer) return { hit: true, exp: { ...expectedZip.get(outer), inner: true } };
          return { hit: false, exp: null };
        };
        const inZip = new Set(out.zip.entries);
        for (const [zp, exp] of expectedZip) if (exp && !inZip.has(zp)) mm.push({ kind: 'missing_in_zip', path: exp.source, detail: zp === exp.source ? '배포 목록에 있으나 zip 에 없음' : `배포 목록에 있으나 zip 에 없음(기대 경로 ${zp})` });
        for (const p of out.zip.entries) if (!lookup(p).hit) mm.push({ kind: 'extra_in_zip', path: p, detail: 'zip 에 있으나 배포 목록에 없음' });
        // 컴파일 산출물(compare: exists) — 일반 파일인지만 보고 바이트·git 유형 대조는 건너뛴다(D38). 판독(CRC)은 한다. mismatches 가 아니라 bytes_skipped 에 적는다
        const skipped = [];
        const toCompare = [];
        for (const e of files) {
          const { exp } = lookup(e.name);
          if (!exp) continue;
          if (exp.compare === 'exists') {
            if (e.type !== 'file') { mm.push({ kind: 'type', path: e.name, detail: `컴파일 산출물 zip 항목 유형 ${e.type} — 일반 파일만 인정` }); continue; }
            try { z.read(e); } catch (err) { mm.push({ kind: 'corrupt', path: e.name, detail: err.message }); continue; }
            skipped.push(e.name);
          } else toCompare.push({ e, src: exp.source });
        }
        out.zip.bytes_skipped = skipped.sort();
        out.zip.bytes_source = snap.mode === 'worktree' ? 'worktree' : 'blobs';
        if (snap.mode === 'worktree') {
          for (const { e, src } of toCompare) {
            const gt = gitType(snap.checkout, snap.head_sha, src);
            if (e.type !== gt) { mm.push({ kind: 'type', path: src, detail: `zip 항목 유형 ${e.type} ≠ head 의 git 유형 ${gt}` }); continue; }
            let zb;
            try { zb = z.read(e); } catch (err) { mm.push({ kind: 'corrupt', path: src, detail: err.message }); continue; }
            const gb = gitShow(snap.checkout, snap.head_sha, src);
            if (!gb || !gb.equals(zb)) mm.push({ kind: 'bytes', path: src, detail: `git show ${snap.head_sha.slice(0, 7)}:${src} 와 바이트 불일치` });
          }
        } else {
          // diff-only(1.3.1 ③ — spec 2026-10-22 3.③) — collect 가 받은 head 원문 `W/blobs/head/` 와 대조한다. 유형은 zip 쪽만 본다(일반 파일만 대조 — tree API 유형 대조는 안 함, D22).
          // 원문을 못 받은 경로(unrecovered·blob 없음)는 경로별 대조 불가. blob 경로는 복원 루트 안으로만 해소한다(경로는 소스 경로 — 1.3.2 ⑨ 매핑 뒤에도 같다)
          const headRoot = path.join(work, 'blobs', 'head');
          const unrecovered = new Set(snap.unrecovered || []);
          for (const { e, src } of toCompare) {
            if (e.type !== 'file') { mm.push({ kind: 'type', path: src, detail: `diff-only — zip 항목 유형 ${e.type} 확인 불가(일반 파일만 대조)` }); continue; }
            const blob = insideRoot(headRoot, src);
            if (unrecovered.has(src) || !blob || !fs.lstatSync(blob, { throwIfNoEntry: false })?.isFile()) { mm.push({ kind: 'bytes_unavailable', path: src, detail: 'head 원문 미확보 — 바이트 대조 불가' }); continue; }
            let zb;
            try { zb = z.read(e); } catch (err) { mm.push({ kind: 'corrupt', path: src, detail: err.message }); continue; }
            if (!fs.readFileSync(blob).equals(zb)) mm.push({ kind: 'bytes', path: src, detail: `blobs/head/${src}와 바이트 불일치` });
          }
        }
      }
    }
  }
  // ④ 삭제 목록은 기대가 비어 있어도 항상 집합 비교(순서 무관) — 본문에만 있는 삭제 지시(기대에 없는 경로)는 배포자가 정상 파일을 지우게 하므로 불일치다.
  // 1.3.2 ⑨ — 양쪽을 zip 경로로 정규화(소스 접두는 매핑 · 이미 zip 경로 꼴은 그대로)한 뒤 비교한다. detail 에는 원문을 적는다.
  // 내부 클래스(maven-war)는 ② 와 같은 2단계 — 본문 이름 그대로 먼저, 없을 때만 삭제한 .java 의 산출물(compare: exists)인 바깥 클래스로 본다(`$` 든 리소스·`Foo$Bar.java` 의 고유 이름을 합치지 않는다 — R1-1)
  {
    const expMapped = out.expected.deleted.map((p) => zipPathFor(layout, p));
    const expDel = new Set(expMapped.map((t) => t.zip));
    const expClasses = new Set(expMapped.filter((t) => t.compare === 'exists').map((t) => t.zip));
    const normBody = (p) => { const zp = zipPathFor(layout, p).zip; if (expDel.has(zp)) return zp; const outer = layout === 'maven-war' ? outerClasses(zp).find((o) => expClasses.has(o)) : null; return outer || zp; };
    // 배포 소스와 삭제 소스가 같은 zip 경로로 사상되면(소스 이동 resources → java 등) 삭제 지시가 새로 배포한 파일을 지운다 — map_conflict(대조 불가 — fail-closed, R2-1)
    const deployBy = new Map();
    for (const p of out.expected.deploy) { const zp = zipPathFor(layout, p).zip; if (!deployBy.has(zp)) deployBy.set(zp, []); deployBy.get(zp).push(p); }
    for (const [i, t] of expMapped.entries()) if (deployBy.has(t.zip)) mm.push({ kind: 'map_conflict', path: t.zip, detail: `소스 두 경로가 같은 배포 경로로 사상됨: ${deployBy.get(t.zip).join(', ')}, ${out.expected.deleted[i]}(삭제)` });
    // 삭제 목록(기대·본문 — zip 경로로 사상, 내부 클래스 폴백 없이 이름 그대로)의 경로가 zip 항목에도 있으면 배포 뒤 삭제가 방금 배포한 파일을 지운다 — 경우별이 아니라 이 한 규칙으로 막는다(R3-1, 추천 자동 채택(위임))
    const inZipEntries = new Set(out.zip.entries);
    const delZip = new Map();
    for (const p of [...out.expected.deleted, ...out.bodyDeletedList]) { const zp = zipPathFor(layout, p).zip; if (!delZip.has(zp)) delZip.set(zp, []); if (!delZip.get(zp).includes(p)) delZip.get(zp).push(p); }
    for (const [zp, srcs] of delZip) if (inZipEntries.has(zp) && !mm.some((m) => m.kind === 'map_conflict' && m.path === zp)) mm.push({ kind: 'map_conflict', path: zp, detail: `삭제 목록의 경로가 zip 에도 들어 있음 — 배포 뒤 삭제하면 방금 배포한 파일이 지워진다: ${srcs.join(', ')}` });
    const bodyDel = new Set(out.bodyDeletedList.map(normBody));
    const same = expDel.size === bodyDel.size && [...expDel].every((p) => bodyDel.has(p));
    if (!same) mm.push({ kind: 'deleted_list', path: null, detail: `삭제 목록 불일치 — 기대 [${out.expected.deleted.join(', ') || '없음'}] / 본문 [${out.bodyDeletedList.join(', ') || '없음'}]` });
  }
  if (out.result !== 'zip 누락') {
    if (mm.some((m) => m.kind === 'download' || m.kind === 'corrupt' || m.kind === 'bytes_unavailable' || m.kind === 'map_conflict')) out.result = '대조 불가';
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
