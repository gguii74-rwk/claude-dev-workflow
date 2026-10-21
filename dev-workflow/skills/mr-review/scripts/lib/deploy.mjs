// deploy.mjs — spec §5.2b. 기대 목록(4.7 규칙·--no-renames) → zip 다운로드 → ①주석 SHA ②목록 ③바이트 ④삭제 목록 대조. 모델 없이.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { apiRaw } from './gitlab.mjs';
import { matchesAny } from './adapter.mjs';

const MAX_BUFFER = 512 * 1024 * 1024;

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
export function readZip(buf) {
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip EOCD 없음');
  const count = buf.readUInt16LE(eocd + 10);
  const cdOff = buf.readUInt32LE(eocd + 16);
  const cLen = buf.readUInt16LE(eocd + 20);
  const comment = buf.subarray(eocd + 22, eocd + 22 + cLen).toString('utf8');
  const entries = [];
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
    const name = buf.subarray(p + 46, p + 46 + nLen).toString('utf8');
    entries.push({ name, flags, method, crc, csize, usize, lho, cd: p });
    p += 46 + nLen + eLen + cmLen;
  }
  const read = (e) => {
    const h = e.lho;
    if (h + 30 > buf.length || buf.readUInt32LE(h) !== 0x04034b50) throw new Error(`zip local header 손상: ${e.name}`);
    const nLen = buf.readUInt16LE(h + 26);
    const eLen = buf.readUInt16LE(h + 28);
    // local header ↔ central directory 정합(R3-8) — 파일명·압축 방식이 다르면 표준 리더가 거부하는 zip 이다
    const lName = buf.subarray(h + 30, h + 30 + nLen).toString('utf8');
    const lMethod = buf.readUInt16LE(h + 8);
    if (lName !== e.name) throw new Error(`zip local header 파일명 불일치(${lName} ≠ ${e.name})`);
    if (lMethod !== e.method) throw new Error(`zip local header 압축 방식 불일치(${lMethod} ≠ ${e.method}): ${e.name}`);
    // 일반 목적 플래그도 대조(C1 R3-8 잔존) — local 0·central 1(암호화) 처럼 어긋나면 표준 리더가 거부하는 zip 이고, 암호화(bit0)·강한 암호화(bit6)는 미지원이라 읽을 수 없는 배포본이다
    const lFlags = buf.readUInt16LE(h + 6);
    if (lFlags !== e.flags) throw new Error(`zip local header 플래그 불일치(${lFlags} ≠ ${e.flags}): ${e.name}`);
    if (e.flags & 0x0041) throw new Error(`zip 암호화 플래그(미지원): ${e.name}`);
    const start = h + 30 + nLen + eLen;
    if (start + e.csize > buf.length) throw new Error(`zip 데이터 범위 초과: ${e.name}`);
    const data = buf.subarray(start, start + e.csize);
    let out;
    if (e.method === 0) out = Buffer.from(data);
    else if (e.method === 8) out = zlib.inflateRawSync(data);
    else throw new Error(`지원하지 않는 압축 방식(${e.method}): ${e.name}`);
    if (out.length !== e.usize) throw new Error(`zip 크기 불일치(${out.length} ≠ ${e.usize}): ${e.name}`);
    const c = crc32(out);
    if (c !== e.crc) throw new Error(`zip CRC 불일치(${c.toString(16)} ≠ ${e.crc.toString(16)}): ${e.name}`);
    return out;
  };
  return { comment, entries, read };
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
      try {
        buf = apiRaw(`projects/${mr.project.id}/uploads/${att.secret}/${att.filename}`);
        fs.mkdirSync(path.join(work, 'zip'), { recursive: true });
        fs.writeFileSync(path.join(work, 'zip', path.basename(att.filename)), buf);
        out.zip.downloaded = true;
      } catch (e) {
        mm.push({ kind: 'download', path: null, detail: `다운로드 실패: ${e.message.slice(0, 160)}` });
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
