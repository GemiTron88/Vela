#!/usr/bin/env python3
"""User-context pinned tooling. Never apt-upgrades a production host or accepts SDK licenses silently."""
import argparse, hashlib, json, os, subprocess, tarfile, tempfile, urllib.request, zipfile
from pathlib import Path

def download(url, destination, expected):
    if not url.startswith('https://') or len(expected) != 64: raise ValueError('HTTPS URL and verified SHA256 required')
    digest = hashlib.sha256()
    with urllib.request.urlopen(url,timeout=60) as src, destination.open('wb') as out:
        while data := src.read(1024*1024): out.write(data); digest.update(data)
    if digest.hexdigest() != expected: destination.unlink(); raise ValueError('CHECKSUM_MISMATCH')

def main():
    from host_policy import require_workstation
    require_workstation()
    p=argparse.ArgumentParser()
    p.add_argument('--root',required=True); p.add_argument('--flutter-version',required=True)
    p.add_argument('--sdktools-url'); p.add_argument('--sdktools-sha256'); p.add_argument('--licenses-reviewed',action='store_true')
    p.add_argument('--install-emulator',action='store_true'); p.add_argument('--android-api',type=int,default=35)
    p.add_argument('--build-tools',default='35.0.0'); a=p.parse_args()
    root=Path(a.root).resolve(); root.mkdir(parents=True,exist_ok=True)
    if os.uname().machine != 'x86_64': raise ValueError('This provisioner supports Linux x86_64; use official toolchain on other hosts')
    metadata=json.load(urllib.request.urlopen('https://storage.googleapis.com/flutter_infra_release/releases/releases_linux.json',timeout=30))
    release=next((r for r in metadata['releases'] if r.get('version') == a.flutter_version and r.get('dart_sdk_arch') == 'x64' and r['channel']=='stable'),None)
    if not release: raise ValueError('Requested Flutter stable pin not found in official release metadata')
    target=root/f'flutter-{a.flutter_version}'
    if not target.exists():
        with tempfile.TemporaryDirectory(dir=root,prefix='provision-') as temp:
            archive=Path(temp)/'flutter.tar.xz'
            download(metadata['base_url']+'/'+release['archive'],archive,release['sha256'])
            with tarfile.open(archive) as tar: tar.extractall(Path(temp),filter='data')
            (Path(temp)/'flutter').rename(target)
    env={**os.environ,'CI':'true','ANDROID_HOME':str(root/'android-sdk'),'ANDROID_SDK_ROOT':str(root/'android-sdk')}
    subprocess.run([str(target/'bin/flutter'),'--version'],env=env,check=True)
    if a.sdktools_url:
        if not a.sdktools_url.startswith('https://dl.google.com/android/repository/'): raise ValueError('Official Android archive URL required')
        if not a.sdktools_sha256: raise ValueError('Verify Android archive SHA256 from official download page first')
        dest=root/'android-sdk/cmdline-tools/latest'
        if not dest.exists():
            with tempfile.TemporaryDirectory(dir=root,prefix='android-provision-') as temp:
                archive=Path(temp)/'tools.zip'; download(a.sdktools_url,archive,a.sdktools_sha256)
                with zipfile.ZipFile(archive) as z:
                    for item in z.infolist():
                        if not item.filename.startswith('cmdline-tools/') or '..' in Path(item.filename).parts: raise ValueError('INVALID_ARCHIVE')
                    z.extractall(temp)
                dest.parent.mkdir(parents=True,exist_ok=True); (Path(temp)/'cmdline-tools').rename(dest)
                for file in (dest/'bin').iterdir(): file.chmod(0o755)
        manager=str(dest/'bin/sdkmanager')
        if not a.licenses_reviewed: print('BLOCKED: review Android SDK licenses using sdkmanager --licenses; rerun with --licenses-reviewed after acceptance'); return
        packages=['platform-tools',f'platforms;android-{a.android_api}',f'build-tools;{a.build_tools}']
        if a.install_emulator: packages+=['emulator',f'system-images;android-{a.android_api};google_apis;x86_64']
        subprocess.run([manager,*packages],env=env,check=True)
    print(json.dumps({'status':'TOOLCHAIN_INSTALLED_EMULATOR_NOT_TESTED','flutter':str(target),'android_sdk':env['ANDROID_HOME']}))

if __name__=='__main__': main()
