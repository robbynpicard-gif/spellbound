"""Rebuild only the in-game wizard sprites (public/assets/art/wizard-*.png), not the backdrops."""
import os, sys
import build as B
import interior as I
import wizards as WZ

if __name__ == '__main__':
    only = sys.argv[1:] or list(WZ.WIZARDS)
    img, L = B.render('ch1')
    for k in only:
        for look in 'ABC':
            B.wizard(L, I.THEMES['ch1'], k, look).save(os.path.join(B.OUT, f'wizard-{k}-{look.lower()}.png'), optimize=True)
    print('built', only)
