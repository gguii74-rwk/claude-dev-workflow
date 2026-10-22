// deploy.mjs — spec §5.2b. 기대 목록(4.7 규칙·--no-renames) → zip 다운로드 → ①주석 SHA ②목록 ③바이트 ④삭제 목록 대조. 모델 없이.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { apiRaw } from './gitlab.mjs';
import { matchesAny } from './adapter.mjs';

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
  try { return UTF8.decode(raw); } catch { throw new Error(`zip 파일명이 올바른 UTF-8 이 아님: ${raw.toString('latin1')}`); }
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
    entries.push({ name, raw, flags, method, crc, csize, usize, lho, cd: p, type });
    p += 46 + nLen + eLen + cmLen;
  }
  if (p !== eocd) throw new Error(`zip EOCD 목차 크기 불일치(파싱한 목차 끝 ${p} ≠ EOCD ${eocd})`);
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
    const start = h + 30 + nLen + eLen;
    if (start + e.csize > buf.length) throw new Error(`zip 데이터 범위 초과: ${e.name}`);
    const data = buf.subarray(start, start + e.csize);
    // 압축 폭탄(impl SDD 이월 T04① + R1-7) — 선언 크기를 먼저 상한과 대조하고, 풀기는 선언 크기까지만 허용한다(넘으면 할당 전에 멈춘다)
    if (e.usize > MAX_ENTRY) throw new Error(`zip 항목 비압축 크기 상한 초과(${e.usize} > ${MAX_ENTRY}): ${e.name}`);
    let out;
    if (e.method === 0) out = Buffer.from(data);
    else if (e.method === 8) {
      try { out = zlib.inflateRawSync(data, { maxOutputLength: Math.max(1, e.usize) }); }
      catch (err) { throw new Error(`zip 압축 해제가 선언 크기(${e.usize})를 넘거나 손상: ${e.name} (${err.code || err.message})`); }
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
  const out = { applicable: false, reason: null, expected: { deploy: [], deleted: [] }, zip: { attachment: null, downloaded: false, comment_sha: null, entries: [] }, bodyDeletedList: parseDeletedList(mr.description || ''), result: '해당 없음', mismatches: [] };
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
        const inZip = new Set(out.zip.entries);
        const expSet = new Set(out.expected.deploy);
        for (const p of out.expected.deploy) if (!inZip.has(p)) mm.push({ kind: 'missing_in_zip', path: p, detail: '배포 목록에 있으나 zip 에 없음' });
        for (const p of out.zip.entries) if (!expSet.has(p)) mm.push({ kind: 'extra_in_zip', path: p, detail: 'zip 에 있으나 배포 목록에 없음' });
        if (snap.mode === 'worktree') {
          for (const e of files) {
            if (!expSet.has(e.name)) continue;
            const gt = gitType(snap.checkout, snap.head_sha, e.name);
            if (e.type !== gt) { mm.push({ kind: 'type', path: e.name, detail: `zip 항목 유형 ${e.type} ≠ head 의 git 유형 ${gt}` }); continue; }
            let zb;
            try { zb = z.read(e); } catch (err) { mm.push({ kind: 'corrupt', path: e.name, detail: err.message }); continue; }
            const gb = gitShow(snap.checkout, snap.head_sha, e.name);
            if (!gb || !gb.equals(zb)) mm.push({ kind: 'bytes', path: e.name, detail: `git show ${snap.head_sha.slice(0, 7)}:${e.name} 와 바이트 불일치` });
          }
        } else {
          mm.push({ kind: 'bytes', path: null, detail: 'diff-only 모드 — 로컬 체크아웃이 없어 바이트 대조 불가(로컬 clone 권장)' });
        }
      }
    }
  }
  // ④ 삭제 목록은 기대가 비어 있어도 항상 집합 비교(순서 무관) — 본문에만 있는 삭제 지시(기대에 없는 경로)는 배포자가 정상 파일을 지우게 하므로 불일치다
  {
    const expDel = new Set(out.expected.deleted);
    const bodyDel = new Set(out.bodyDeletedList);
    const same = expDel.size === bodyDel.size && [...expDel].every((p) => bodyDel.has(p));
    if (!same) mm.push({ kind: 'deleted_list', path: null, detail: `삭제 목록 불일치 — 기대 [${[...expDel].join(', ') || '없음'}] / 본문 [${[...bodyDel].join(', ') || '없음'}]` });
  }
  if (out.result !== 'zip 누락') {
    if (mm.some((m) => m.kind === 'download' || m.kind === 'corrupt' || (m.kind === 'bytes' && m.path === null))) out.result = '대조 불가';
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
