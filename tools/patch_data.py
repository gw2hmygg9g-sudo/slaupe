"""Patch values inside Build/slope_data.unityweb (the original game's data).

Needs Python 3 and UnityPy (pip install UnityPy). Run from the repo root:
    python3 tools/patch_data.py Build/slope_data.unityweb
It edits the file in place. Keep the original from git if you want to undo.
"""
import sys
import UnityPy

TRAIL_SECONDS = 1.0      # original 0.5: how long the light trail behind the ball lasts
TRAIL_END_WIDTH = 0.15   # original 1.0: the trail narrows from 1 (ball size) to this at its tail

path = sys.argv[1]
env = UnityPy.load(path)
done = 0
for obj in env.objects:
    if obj.type.name != 'TrailRenderer':
        continue
    t = obj.read_typetree()
    t['m_Time'] = TRAIL_SECONDS
    keys = t['m_Parameters']['widthCurve']['m_Curve']
    keys[-1]['value'] = TRAIL_END_WIDTH
    slope = TRAIL_END_WIDTH - keys[0]['value']
    keys[0]['outSlope'] = slope
    keys[-1]['inSlope'] = slope
    obj.save_typetree(t)
    done += 1

web = list(env.files.values())[0]
with open(path, 'wb') as f:
    f.write(web.save())
print('patched trail renderers:', done)
