//! Local control of Philips Air+ purifiers (tested on AC0950) over encrypted CoAP,
//! the same protocol as the Air+ app on the LAN. No cloud account needed.

use aes::cipher::{block_padding::Pkcs7, BlockDecryptMut, BlockEncryptMut, KeyIvInit};
use md5::{Digest, Md5};
use sha2::Sha256;
use std::net::{Ipv4Addr, UdpSocket};
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::{Duration, Instant};

const PORT: u16 = 5683;
const POWER: &str = "D03102";
const MODE: &str = "D0310C";

static NEXT_ID: AtomicU32 = AtomicU32::new(0x5a00);

pub struct Status {
    pub on: bool,
    pub mode: &'static str,
    pub aq: &'static str,
    pub filter: u8,
}

fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02X}")).collect()
}

fn unhex(s: &str) -> Option<Vec<u8>> {
    (0..s.len()).step_by(2).map(|i| u8::from_str_radix(s.get(i..i + 2)?, 16).ok()).collect()
}

fn key_iv(key: &str) -> ([u8; 16], [u8; 16]) {
    let h = hex(&Md5::digest(format!("JiangPan{key}")));
    let b = h.as_bytes();
    (b[..16].try_into().unwrap(), b[16..].try_into().unwrap())
}

fn encrypt(key: &str, plain: &str) -> String {
    let (k, iv) = key_iv(key);
    let ct = hex(&cbc::Encryptor::<aes::Aes128>::new(&k.into(), &iv.into())
        .encrypt_padded_vec_mut::<Pkcs7>(plain.as_bytes()));
    let digest = hex(&Sha256::digest(format!("{key}{ct}")));
    format!("{key}{ct}{digest}")
}

fn decrypt(payload: &str) -> Option<String> {
    if payload.len() < 72 {
        return None;
    }
    let (key, rest) = payload.split_at(8);
    let ct = &rest[..rest.len() - 64];
    let (k, iv) = key_iv(key);
    let plain = cbc::Decryptor::<aes::Aes128>::new(&k.into(), &iv.into())
        .decrypt_padded_vec_mut::<Pkcs7>(&unhex(ct)?)
        .ok()?;
    String::from_utf8(plain).ok()
}

fn message(post: bool, path: &str, observe: bool, token: [u8; 4], payload: &str) -> Vec<u8> {
    let id = NEXT_ID.fetch_add(1, Ordering::Relaxed).to_be_bytes();
    let mut msg = vec![0x44, if post { 2 } else { 1 }, id[2], id[3]];
    msg.extend_from_slice(&token);
    let mut last = 0u8;
    let mut opts: Vec<(u8, &[u8])> = Vec::new();
    if observe {
        opts.push((6, &[]));
    }
    opts.extend(path.split('/').map(|p| (11, p.as_bytes())));
    for (n, v) in opts {
        msg.push(((n - last) << 4) | v.len() as u8);
        msg.extend_from_slice(v);
        last = n;
    }
    if !payload.is_empty() {
        msg.push(0xff);
        msg.extend_from_slice(payload.as_bytes());
    }
    msg
}

/// Read one packet, acking it if confirmable: the purifier holds every later
/// message to us until its last confirmable one is acked.
fn recv(sock: &UdpSocket, ip: &str, buf: &mut [u8]) -> Option<usize> {
    let n = sock.recv(buf).ok()?;
    if n >= 4 && buf[0] >> 4 & 3 == 0 {
        let _ = sock.send_to(&[0x60, 0, buf[2], buf[3]], (ip, PORT));
    }
    (n >= 4).then_some(n)
}

fn payload(m: &[u8]) -> Option<String> {
    let mut i = 4 + (m[0] & 15) as usize;
    while i < m.len() && m[i] != 0xff {
        let (d, l) = (m[i] >> 4, (m[i] & 15) as usize);
        i += match d { 13 => 2, 14 => 3, _ => 1 };
        i += match l {
            13 => 1 + 13 + *m.get(i)? as usize,
            14 => 2 + 269 + u16::from_be_bytes([*m.get(i)?, *m.get(i + 1)?]) as usize,
            _ => l,
        };
    }
    String::from_utf8(m.get(i + 1..)?.to_vec()).ok()
}

/// One POST and its reply, on a throwaway socket (no observe, so nothing lingers).
fn post(ip: &str, path: &str, body: &str) -> Option<String> {
    let sock = UdpSocket::bind("0.0.0.0:0").ok()?;
    sock.set_read_timeout(Some(Duration::from_millis(500))).ok()?;
    let token = NEXT_ID.fetch_add(1, Ordering::Relaxed).to_be_bytes();
    sock.send_to(&message(true, path, false, token, body), (ip, PORT)).ok()?;
    let deadline = Instant::now() + Duration::from_secs(3);
    let mut buf = [0u8; 512];
    while Instant::now() < deadline {
        let Some(n) = recv(&sock, ip, &mut buf) else { continue };
        if buf[0] & 15 == 4 && buf[4..8] == token && buf[1] >= 64 {
            return payload(&buf[..n]);
        }
    }
    None
}

fn sync(ip: &str) -> Option<String> {
    post(ip, "sys/dev/sync", "1A2B3C4D").filter(|k| k.len() == 8)
}

fn num(v: &serde_json::Value, k: &str) -> i64 {
    v[k].as_i64().unwrap_or(0)
}

fn parse_status(raw: &str) -> Option<Status> {
    let v: serde_json::Value = serde_json::from_str(&decrypt(raw)?).ok()?;
    let r = &v["state"]["reported"];
    let total = num(r, "D05408").max(1);
    Some(Status {
        on: num(r, POWER) == 1,
        mode: match num(r, MODE) {
            0 => "Auto",
            17 => "Sleep",
            _ => "Manual",
        },
        aq: match num(r, "D03120") {
            0..=3 => "Good",
            4..=6 => "Fair",
            7..=9 => "Poor",
            _ => "Very poor",
        },
        filter: (num(r, "D0540E") * 100 / total).clamp(0, 100) as u8,
    })
}

/// Subscribe to status pushes and call `on` for each, like the Air+ app does.
/// Polling instead leaves an observer per request and the purifier stalls.
/// Returns once the purifier has been silent for 2 minutes.
pub fn watch(ip: &str, mut on: impl FnMut(Status)) {
    let Ok(sock) = UdpSocket::bind("0.0.0.0:0") else { return };
    let _ = sock.set_read_timeout(Some(Duration::from_secs(1)));
    let mut heard = Instant::now();
    let mut subscribed = Instant::now() - Duration::from_secs(60);
    let mut buf = [0u8; 8192];
    while heard.elapsed() < Duration::from_secs(120) {
        // Same port + token, so re-subscribing replaces our observer.
        if subscribed.elapsed() > Duration::from_secs(60) {
            sync(ip);
            let _ = sock.send_to(&message(false, "sys/dev/status", true, [0x0b, 0x5e, 0x7e, 0x01], ""), (ip, PORT));
            subscribed = Instant::now();
        }
        let Some(n) = recv(&sock, ip, &mut buf) else { continue };
        if let Some(s) = payload(&buf[..n]).as_deref().and_then(parse_status) {
            heard = Instant::now();
            on(s);
        }
    }
}

fn control(ip: &str, fields: serde_json::Value) -> bool {
    let Some(key) = sync(ip).and_then(|k| u32::from_str_radix(&k, 16).ok()) else {
        return false;
    };
    let mut desired = serde_json::json!({ "CommandType": "app", "DeviceId": "", "EnduserId": "" });
    desired.as_object_mut().unwrap().extend(fields.as_object().unwrap().clone());
    let body = serde_json::json!({ "state": { "desired": desired } }).to_string();
    let payload = encrypt(&format!("{:08X}", key.wrapping_add(1)), &body);
    post(ip, "sys/dev/control", &payload).is_some_and(|r| r.contains("success"))
}

pub fn set_power(ip: &str, on: bool) -> bool {
    control(ip, serde_json::json!({ "D03102": on as i64 }))
}

/// "Auto" | "Sleep" | "Manual" (the UI's Boost → turbo).
pub fn set_mode(ip: &str, mode: &str) -> bool {
    let m = match mode { "Sleep" => 17, "Manual" => 18, _ => 0 };
    control(ip, serde_json::json!({ "D03102": 1, "D0310C": m }))
}

/// Ping every host on our /24 and return the first that answers the Philips sync.
pub fn discover() -> Option<String> {
    let probe = UdpSocket::bind("0.0.0.0:0").ok()?;
    probe.connect("8.8.8.8:80").ok()?;
    let std::net::IpAddr::V4(me) = probe.local_addr().ok()?.ip() else { return None };
    let [a, b, c, _] = me.octets();
    let sock = UdpSocket::bind("0.0.0.0:0").ok()?;
    sock.set_read_timeout(Some(Duration::from_secs(2))).ok()?;
    for d in 1..255u8 {
        let _ = sock.send_to(&[0x40, 0, 0x12, 0x34], (Ipv4Addr::new(a, b, c, d), PORT));
    }
    let mut buf = [0u8; 64];
    let deadline = Instant::now() + Duration::from_secs(2);
    while Instant::now() < deadline {
        // Errors here are mostly ICMP port-unreachable from other hosts; keep listening.
        let Ok((_, from)) = sock.recv_from(&mut buf) else { continue };
        let ip = from.ip().to_string();
        if sync(&ip).is_some() {
            return Some(ip);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypt_roundtrip() {
        let p = encrypt("2F5767F6", r#"{"state":{"reported":{"D03102":1}}}"#);
        assert!(p.starts_with("2F5767F6"));
        assert_eq!(decrypt(&p).unwrap(), r#"{"state":{"reported":{"D03102":1}}}"#);
    }
}
