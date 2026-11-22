# Key-art slicing (D-093)
Rebuilds `public/assets/typel/keyart/*` and `src/typel/render/keyart.json` from the owner's painting.

Requires: Python 3, opencv-contrib-python, numpy.

1. Make a work folder with two files:
   - `ref_hi.png`: the full-resolution painting (the original is 5376×3024; a high-quality JPEG copy is at `art/reference/`);
   - `ref.png`: the same painting resized to 1344×756.

   Every coordinate in the scripts is in this 1344×756 space.
2. From that folder, run `python3 plate.py`. It removes the live elements and writes `plate_ref.png` and `changed.png`.
3. Run `python3 sprites.py`. It writes `out/` with every layer at 1920×1080, plus `keyart.json`.
4. Copy `out/*.png, *.jpg, *.webp` to `public/assets/typel/keyart/` and `out/keyart.json` to `src/typel/render/`.

To replace a layer with better art, keep its file name, size and position.
