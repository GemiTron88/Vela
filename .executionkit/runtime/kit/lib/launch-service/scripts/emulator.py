#!/usr/bin/env python3
"""Disposable KVM-only headless Android test session; skips unsupported hosts truthfully."""
import argparse, json, os, re, shutil, signal, subprocess, tempfile, time, uuid
from pathlib import Path
from diagnose import diagnose
from runner import HostLock

def main():
    from host_policy import require_workstation
    require_workstation()
    p=argparse.ArgumentParser(); p.add_argument('--sdk',required=True); p.add_argument('--work-root',required=True)
    p.add_argument('--apk',required=True); p.add_argument('--package',required=True); p.add_argument('--evidence',required=True)
    p.add_argument('--api',type=int,default=35); p.add_argument('--port',type=int,default=5580)
    p.add_argument('--test-apk'); p.add_argument('--instrumentation'); p.add_argument('--allow-package-replacement',action='store_true')
    a=p.parse_args()
    if not re.fullmatch(r'[A-Za-z]\w*(?:\.[A-Za-z]\w*)+',a.package): raise ValueError('INVALID_PACKAGE')
    if a.port < 5554 or a.port > 5682 or a.port%2: raise ValueError('INVALID_EMULATOR_PORT')
    sdk=Path(a.sdk).resolve(); root=Path(a.work_root).resolve(); root.mkdir(parents=True,exist_ok=True)
    evidence=Path(a.evidence).resolve(); evidence.mkdir(parents=True,exist_ok=True)
    os.environ['PATH']=str(sdk/'emulator')+os.pathsep+os.environ['PATH']; report=diagnose()
    if not report['kvm_accessible'] or report['architecture'] != 'x86_64' or subprocess.run([str(sdk/'emulator/emulator'),'-accel-check'],capture_output=True,timeout=20).returncode != 0:
        result={'status':'NOT_TESTED','reason':'KVM_OR_ACCELERATION_UNAVAILABLE','diagnostics':report}
        (evidence/'emulator-result.json').write_text(json.dumps(result,indent=2)); print(json.dumps(result)); return 20
    if shutil.disk_usage(root).free < 8*1024**3: raise ValueError('INSUFFICIENT_DISK')
    lock=HostLock(root/'.emulator.lock')
    apk=Path(a.apk).resolve(); emulator=sdk/'emulator/emulator'; adb=sdk/'platform-tools/adb'; serial=f'emulator-{a.port}'
    manager=sdk/'cmdline-tools/latest/bin/avdmanager'; name='release-'+str(uuid.uuid4()); temp=Path(tempfile.mkdtemp(dir=root,prefix='avd-'))
    env={**os.environ,'ANDROID_AVD_HOME':str(temp),'ANDROID_HOME':str(sdk),'CI':'true'}; proc=None
    started=time.monotonic(); timings={}; log=(evidence/'emulator.log').open('wb')
    def execute(args,timeout=60): return subprocess.check_output([str(adb),'-s',serial,*args],env=env,timeout=timeout)
    try:
        subprocess.run([str(manager),'create','avd','--name',name,'--package',f'system-images;android-{a.api};google_apis;x86_64','--path',str(temp/name)],input='no\n',text=True,env=env,check=True,capture_output=True)
        proc=subprocess.Popen([str(emulator),'-avd',name,'-port',str(a.port),'-no-window','-no-audio','-no-snapshot','-gpu','software','-memory','2048','-cores','2','-accel','on'],env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
        deadline=time.monotonic()+240
        while time.monotonic()<deadline:
            if proc.poll() is not None: raise RuntimeError('EMULATOR_EXITED')
            try:
                if execute(['shell','getprop','sys.boot_completed'],10).strip()==b'1': break
            except (subprocess.SubprocessError,OSError): pass
            time.sleep(2)
        else: raise RuntimeError('BOOT_TIMEOUT')
        timings['boot_seconds']=round(time.monotonic()-started,2)
        # New disposable AVD. -r only by explicit flag for package replacement fixtures.
        execute(['install',*(['-r'] if a.allow_package_replacement else []),str(apk)],180)
        execute(['shell','monkey','-p',a.package,'-c','android.intent.category.LAUNCHER','1'])
        time.sleep(3)
        pid=execute(['shell','pidof',a.package]).strip()
        if not pid: raise RuntimeError('APP_PROCESS_NOT_RUNNING')
        (evidence/'launch.png').write_bytes(execute(['exec-out','screencap','-p']))
        (evidence/'logcat.log').write_bytes(execute(['logcat','-d','-v','brief']))
        # These logs must use a synthetic account/backend; never production banking SMS.
        tests='NOT_TESTED'
        if a.test_apk and a.instrumentation:
            if not re.fullmatch(r'[A-Za-z0-9_.$]+/[A-Za-z0-9_.$]+',a.instrumentation): raise ValueError('INVALID_TEST_COMPONENT')
            execute(['install',str(Path(a.test_apk).resolve())],180)
            output=execute(['shell','am','instrument','-w',a.instrumentation],600)
            (evidence/'instrumentation.log').write_bytes(output)
            if b'FAILURES!!!' in output or not re.search(rb'OK \(\d+ tests?\)',output): raise RuntimeError('INSTRUMENTATION_FAILED_OR_NO_TESTS')
            tests='PASS'
        result={'status':'PASS_INSTALL_LAUNCH','instrumentation':tests,'package_replacement':'NOT_TESTED','sms_recovery':'NOT_TESTED','serial':serial,'timings':timings,'total_seconds':round(time.monotonic()-started,2)}
        (evidence/'emulator-result.json').write_text(json.dumps(result,indent=2)); print(json.dumps(result)); return 0
    except Exception as e:
        (evidence/'emulator-result.json').write_text(json.dumps({'status':'FAIL','reason':type(e).__name__,'elapsed_seconds':round(time.monotonic()-started,2)})); raise
    finally:
        if proc:
            try: execute(['emu','kill'],10)
            except Exception: pass
            try: proc.wait(timeout=15)
            except subprocess.TimeoutExpired: os.killpg(proc.pid,signal.SIGKILL); proc.wait()
        log.close(); shutil.rmtree(temp); lock.release()

if __name__=='__main__': raise SystemExit(main())
