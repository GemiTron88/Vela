#!/usr/bin/env python3
"""Read-only pull and signing inspection from an explicitly selected Android device."""
import argparse,subprocess,tempfile,json,hmac,hashlib,os,re
from pathlib import Path
from datetime import datetime,timezone

def main():
    p=argparse.ArgumentParser();p.add_argument('--serial',required=True);p.add_argument('--project',required=True);p.add_argument('--package',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    if not re.fullmatch(r'[a-z][a-z0-9-]{0,63}',a.project) or not re.fullmatch(r'[A-Za-z]\w*(?:\.[A-Za-z]\w*)+',a.package):raise ValueError('INVALID_SCOPE')
    key=os.environ.get('MOBILE_RELEASE_RUNNER_KEY');runner=os.environ.get('MOBILE_RELEASE_RUNNER_ID','runner')
    if not key or len(key)<32:raise ValueError('ATTESTOR_KEY_REQUIRED')
    paths=subprocess.check_output(['adb','-s',a.serial,'shell','pm','path',a.package],text=True).splitlines()
    bases=[s.removeprefix('package:') for s in paths if s.startswith('package:') and s.endswith('/base.apk')]
    if len(bases)!=1:raise ValueError('INSTALLED_BASE_APK_NOT_FOUND')
    with tempfile.TemporaryDirectory(prefix='installed-identity-') as temp:
        apk=Path(temp)/'installed.apk';subprocess.run(['adb','-s',a.serial,'pull',bases[0],str(apk)],check=True,capture_output=True)
        inspect=Path(__file__).resolve().parent.parent/'src/inspect-installed-cli.mjs'
        meta=json.loads(subprocess.check_output(['node',str(inspect),str(apk)],text=True))
        if meta['package_id']!=a.package:raise ValueError('PACKAGE_MISMATCH')
        if meta['debug_signed']:
            print(json.dumps({'status':'BLOCKED_DEBUG_SIGNED_INSTALLED_BASE','signing_sha256':meta['signing_sha256'],'version_code':meta['version_code'],'installed_data':'NOT_MODIFIED','recovery':'Do not uninstall, rotate keys or distribute a differently signed APK. Operator migration review required.'}));return
        b={'project':a.project,'package_id':a.package,'signing_sha256':meta['signing_sha256'],'installed_version_code':meta['version_code'],'installed_apk_sha256':meta['sha256'],'runner_id':runner,'observed_at':datetime.now(timezone.utc).isoformat(),'source':'adb-installed-apk'}
        canonical=json.dumps(b,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
        output=Path(a.output);output.write_text(json.dumps({'payload':b,'signature':hmac.new(key.encode(),canonical,'sha256').hexdigest()},indent=2)+'\n');output.chmod(0o600)
        print(json.dumps({'status':'OBSERVED','package_id':a.package,'version_code':meta['version_code'],'signing_sha256':meta['signing_sha256'],'installed_data':'NOT_MODIFIED'}))
if __name__=='__main__':main()
