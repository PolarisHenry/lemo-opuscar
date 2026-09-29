"""CosyVoice 中文配音：python tts.py → vo/<id>.wav (48k mono, 去首尾静音) + vo/dur.json"""
import sys, os, subprocess

os.chdir(os.path.dirname(os.path.abspath(__file__)))   # 路径相对 demo/
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
TTS_ZH = os.path.join(REPO_ROOT, 'core', 'tts', 'tts_zh.py')

if __name__ == '__main__':
    cmd = [
        sys.executable, TTS_ZH, 'script.json', 'vo',
        '--voice', 'longxiaochun',
        '--rate', '+10%',
        '--pitch', '-2Hz',
        '--sr', '48000'
    ]
    subprocess.run(cmd, check=True)
