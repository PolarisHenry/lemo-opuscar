"""CosyVoice 配音（阿里 CosyVoice 大模型语音合成，中文首选，自然拟真）：
    python core/tts/tts_zh.py lines.json out_dir [--voice longxiaochun] [--model cosyvoice-v1] [--rate +0%] [--pitch +0Hz]
lines.json = [{"id":..., "text":..., "voice":"longxiaochun", "rate":"+10%", "pitch":"-2Hz", "say":"..."}, ...]
  "say"（可选）= 实际送去朗读的文字，默认同 "text"（数字、缩写要写成读法时用；字幕仍用 text）。
  也认 tts.py 的 "speed"（倍速，1.1 → +10%）。
  常用音色（DashScope CosyVoice）：
    longxiaochun（知性温柔女声，默认）
    longwan（成熟知性女声）
    longcheng（稳重质感男声，纪录片/解说首选）
    longhua（活泼明快女声）
    longxiaoxia（亲切甜美女声）
    longyueming（自然阳光男声）
输出与 tts.py 完全一致：out_dir/<id>.wav（24kHz 单声道，去首尾静音）与 out_dir/dur.json。
  中间音频缓存在 out_dir/.cache/，文字/声音/语速没变就不再重复调用（先写 .part 再改名，Ctrl-C 不会留下损坏文件）。

支持两种运行模式：
  1. 阿里 DashScope API（推荐）：需设置环境变量 DASHSCOPE_API_KEY（或命令行传入 --api-key）
  2. 本地 CosyVoice 服务：设置环境变量 COSYVOICE_API_URL（或命令行传入 --api-url）
离线备选：tts.py 的 "lang":"cmn"（Kokoro 本地模型，用 asr_check.py 校对）。
"""
import sys, io, json, os, re, hashlib, subprocess, argparse
import numpy as np, soundfile as sf
SR = 24000

# 兼容旧配置中的 edge-tts 声音名，自动映射到最接近的 CosyVoice 音色
LEGACY_VOICE_MAP = {
    'zh-CN-XiaoxiaoNeural': 'longxiaochun',
    'zh-CN-YunxiNeural': 'longcheng',
    'zh-CN-YunjianNeural': 'longcheng',
    'zh-CN-JennyNeural': 'longxiaochun',
    'zh-CN-AriaNeural': 'longwan',
}


def rate_of(L, default):
    r = L.get('rate')
    if r is None and 'speed' in L:
        r = float(L['speed'])
    if isinstance(r, (int, float)):
        r = f'{round((float(r) - 1) * 100):+d}%'
    return r or default


def rate_to_speech_rate(r_str):
    """Convert '+10%', '-5%', or float like 1.1 into DashScope speech_rate [0.5, 2.0]"""
    if isinstance(r_str, (int, float)):
        return max(0.5, min(2.0, float(r_str)))
    m = re.fullmatch(r'([+-]?\d+(?:\.\d+)?)%', str(r_str).strip())
    if m:
        pct = float(m.group(1))
        return max(0.5, min(2.0, round(1.0 + pct / 100.0, 2)))
    try:
        val = float(r_str)
        return max(0.5, min(2.0, val))
    except (ValueError, TypeError):
        return 1.0


def pitch_to_pitch_rate(p_str):
    """Convert '-2Hz', '+10%', or float into DashScope pitch_rate [0.5, 2.0]"""
    if isinstance(p_str, (int, float)):
        return max(0.5, min(2.0, float(p_str)))
    s = str(p_str).strip()
    m_hz = re.fullmatch(r'([+-]?\d+(?:\.\d+)?)Hz', s, re.IGNORECASE)
    if m_hz:
        hz = float(m_hz.group(1))
        return max(0.5, min(2.0, round(1.0 + hz * 0.02, 2)))
    m_pct = re.fullmatch(r'([+-]?\d+(?:\.\d+)?)%', s)
    if m_pct:
        pct = float(m_pct.group(1))
        return max(0.5, min(2.0, round(1.0 + pct / 100.0, 2)))
    try:
        val = float(s)
        return max(0.5, min(2.0, val))
    except (ValueError, TypeError):
        return 1.0


def resolve_voice(voice):
    if voice in LEGACY_VOICE_MAP:
        mapped = LEGACY_VOICE_MAP[voice]
        print(f"tts_zh.py: mapped legacy voice '{voice}' -> CosyVoice '{mapped}'", file=sys.stderr)
        return mapped
    return voice


def synth_dashscope(text, voice, model, speech_rate, pitch_rate, api_key, path):
    part = path + '.part'
    last = None
    try:
        try:
            import dashscope
            from dashscope.audio.tts_v2 import SpeechSynthesizer, AudioFormat
            dashscope.api_key = api_key
            for attempt in range(3):
                try:
                    synthesizer = SpeechSynthesizer(
                        model=model,
                        voice=voice,
                        format=AudioFormat.WAV_24000HZ_MONO_16BIT,
                        speech_rate=speech_rate,
                        pitch_rate=pitch_rate,
                    )
                    audio = synthesizer.call(text)
                    if audio is None or len(audio) == 0:
                        raise OSError('DashScope returned empty audio data')
                    with open(part, 'wb') as f:
                        f.write(audio)
                    if os.path.getsize(part) == 0:
                        raise OSError('DashScope wrote an empty file')
                    os.replace(part, path)
                    return
                except Exception as e:
                    last = e
                    if 'InvalidApiKey' in str(e) or 'AuthenticationError' in type(e).__name__:
                        break
            raise last
        except ImportError:
            # Fallback to DashScope HTTP REST API if SDK is not installed
            import urllib.request, urllib.error
            headers = {
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
                'X-DashScope-Async': 'disable'
            }
            payload = json.dumps({
                'model': model,
                'input': {'text': text},
                'parameters': {
                    'voice': voice,
                    'format': 'wav',
                    'sample_rate': 24000,
                    'speech_rate': speech_rate,
                    'pitch_rate': pitch_rate
                }
            }).encode('utf-8')
            req = urllib.request.Request(
                'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-to-speech/generation',
                data=payload,
                headers=headers
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                resp_data = resp.read()
                if resp.headers.get_content_type() == 'application/json':
                    res_json = json.loads(resp_data.decode('utf-8'))
                    audio_url = res_json.get('output', {}).get('audio_url')
                    if audio_url:
                        with urllib.request.urlopen(audio_url, timeout=30) as a_resp:
                            with open(part, 'wb') as f:
                                f.write(a_resp.read())
                    else:
                        raise OSError(f'DashScope REST API response missing audio: {res_json}')
                else:
                    with open(part, 'wb') as f:
                        f.write(resp_data)
            if os.path.getsize(part) == 0:
                raise OSError('DashScope REST API returned empty audio')
            os.replace(part, path)
    finally:
        if os.path.exists(part):
            os.remove(part)


def synth_local_api(text, voice, speed, api_url, path):
    import urllib.request
    part = path + '.part'
    try:
        payload = json.dumps({'text': text, 'spk_id': voice, 'speed': speed}).encode('utf-8')
        req = urllib.request.Request(api_url, data=payload, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
        if not data or len(data) == 0:
            raise OSError('Local CosyVoice API returned empty audio')
        with open(part, 'wb') as f:
            f.write(data)
        os.replace(part, path)
    finally:
        if os.path.exists(part):
            os.remove(part)


def to_wav(cached_path, target_sr=SR):
    """解码成指定采样率的单声道；文件损坏则返回 None"""
    try:
        a, sr = sf.read(cached_path, dtype='float32')
        if a.ndim > 1:
            a = a.mean(axis=1)
        if sr != target_sr:
            r = subprocess.run(
                ['ffmpeg', '-y', '-loglevel', 'error', '-i', cached_path, '-ar', str(target_sr), '-ac', '1', '-f', 'wav', '-'],
                capture_output=True, check=True
            )
            a, sr = sf.read(io.BytesIO(r.stdout), dtype='float32')
        return (a, target_sr) if len(a) else None
    except Exception:
        try:
            r = subprocess.run(
                ['ffmpeg', '-y', '-loglevel', 'error', '-i', cached_path, '-ar', str(target_sr), '-ac', '1', '-f', 'wav', '-'],
                capture_output=True, check=True
            )
            a, sr = sf.read(io.BytesIO(r.stdout), dtype='float32')
            return (a, target_sr) if len(a) else None
        except Exception:
            return None


def plausible(decoded, target_sr=SR):
    """缓存音频解出来要像一句话：至少 0.15 秒且非静音"""
    if decoded is None:
        return False
    a, sr = decoded
    return len(a) >= 0.15 * sr and float(np.abs(a).max()) > 1e-3


def trim_silence(y, sr):
    thr = (np.abs(y).max() if len(y) else 0) * 0.02
    nz = np.where(np.abs(y) > thr)[0]
    if len(nz):
        return y[max(0, nz[0] - int(0.03 * sr)): nz[-1] + int(0.10 * sr)]
    return y


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('lines', help='JSON file containing line entries')
    ap.add_argument('out_dir', help='Output directory for wav files and dur.json')
    ap.add_argument('--voice', default='longxiaochun', help='CosyVoice voice name (default: longxiaochun)')
    ap.add_argument('--model', default=os.environ.get('COSYVOICE_MODEL', 'cosyvoice-v1'), help='CosyVoice model name (default: cosyvoice-v1)')
    ap.add_argument('--rate', default='+0%', help='Rate adjustment (+10%%, -5%%, or multiplier like 1.1)')
    ap.add_argument('--pitch', default='+0Hz', help='Pitch adjustment (-2Hz, +0Hz, or +5%%)')
    ap.add_argument('--api-key', default=os.environ.get('DASHSCOPE_API_KEY', ''), help='DashScope API Key')
    ap.add_argument('--api-url', default=os.environ.get('COSYVOICE_API_URL', ''), help='Local CosyVoice API URL')
    ap.add_argument('--sr', type=int, default=SR, help=f'Target sample rate (default: {SR})')
    a = ap.parse_args()

    lines = json.load(open(a.lines, encoding='utf-8'))
    for L in lines:
        r, p = rate_of(L, a.rate), L.get('pitch', a.pitch)
        if isinstance(r, str) and not re.fullmatch(r'[+-]?\d+(?:\.\d+)?%', r):
            try: float(r)
            except ValueError: sys.exit(f"tts_zh.py: line '{L['id']}': rate must look like '+10%' or speed number like 1.1, got {r!r}")
        if isinstance(p, str) and not re.fullmatch(r'[+-]?\d+(?:\.\d+)?(?:Hz|%)', p, re.IGNORECASE):
            try: float(p)
            except ValueError: sys.exit(f"tts_zh.py: line '{L['id']}': pitch must look like '-2Hz' or '+0Hz', got {p!r}")

    api_key = a.api_key.strip()
    api_url = a.api_url.strip()

    if not api_key and not api_url:
        print("tts_zh.py: CosyVoice requires an API key or local service URL:\n"
              "  1. Set DASHSCOPE_API_KEY: export DASHSCOPE_API_KEY=\"sk-...\" (or use --api-key)\n"
              "  2. Or run a local CosyVoice service: export COSYVOICE_API_URL=\"http://localhost:50000/tts\" (or use --api-url)\n"
              "  Offline alternative: python core/tts/tts.py lines.json out/ with \"lang\": \"cmn\" (Kokoro).", file=sys.stderr)
        sys.exit(2)

    os.makedirs(os.path.join(a.out_dir, '.cache'), exist_ok=True)
    dur = {}
    for n in os.listdir(os.path.join(a.out_dir, '.cache')):
        if n.endswith('.part'):
            os.remove(os.path.join(a.out_dir, '.cache', n))

    for L in lines:
        raw_voice = L.get('voice', a.voice)
        voice = resolve_voice(raw_voice)
        r = rate_of(L, a.rate)
        p = L.get('pitch', a.pitch)
        say = L.get('say', L['text'])

        speech_rate = rate_to_speech_rate(r)
        pitch_rate = pitch_to_pitch_rate(p)

        key = hashlib.sha1(json.dumps([a.model, voice, speech_rate, pitch_rate, say], ensure_ascii=False).encode('utf-8')).hexdigest()[:16]
        cached_wav = os.path.join(a.out_dir, '.cache', key + '.wav')

        decoded = to_wav(cached_wav, a.sr) if os.path.exists(cached_wav) else None
        if not plausible(decoded, a.sr):
            decoded = None
        if decoded is None and os.path.exists(cached_wav):
            os.remove(cached_wav)
            print(f"tts_zh.py: cached audio for line '{L['id']}' was damaged; fetching it again", file=sys.stderr)

        if decoded is None:
            try:
                if api_url:
                    synth_local_api(say, voice, speech_rate, api_url, cached_wav)
                else:
                    synth_dashscope(say, voice, a.model, speech_rate, pitch_rate, api_key, cached_wav)
            except Exception as e:
                print(f"tts_zh.py: speech synthesis failed for line '{L['id']}': {type(e).__name__}: {str(e)[:200]}\n"
                      f"  voice: {voice}, model: {a.model}", file=sys.stderr)
                sys.exit(2)
            decoded = to_wav(cached_wav, a.sr)
            if decoded is None:
                sys.exit(f"tts_zh.py: audio returned for line '{L['id']}' could not be decoded; try again")

        y, sr = decoded
        y = trim_silence(y, sr)
        if len(y) == 0 or np.abs(y).max() <= 1e-4:
            print(f"warning: line {L['id']} is silent", file=sys.stderr)

        out_file = os.path.join(a.out_dir, L['id'] + '.wav')
        sf.write(out_file, y, sr)
        dur[L['id']] = round(len(y) / sr, 3)
        print(L['id'], dur[L['id']], L['text'])

    json.dump(dur, open(os.path.join(a.out_dir, 'dur.json'), 'w', encoding='utf-8'), indent=1)


if __name__ == '__main__':
    main()
