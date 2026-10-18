"""Render every deliverable page for visual inspection and extract completeness data."""
from pathlib import Path
import json
import sys
import tempfile
import pypdfium2 as pdfium
from pypdf import PdfReader
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent
output = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(tempfile.gettempdir()) / 'continuity-pdf-check'
output.mkdir(parents=True, exist_ok=True)
report = {}
for name, expected in [('participant-cards', 24), ('facilitator-sheets', 26)]:
    path = root / 'output/pdf' / f'{name}.pdf'
    reader = PdfReader(path)
    assert len(reader.pages) == expected, (name, len(reader.pages))
    pdf = pdfium.PdfDocument(path)
    thumbs = []
    lengths = []
    for index, page in enumerate(reader.pages):
        text = page.extract_text()
        assert len(text.strip()) > 80, (name, index + 1, text)
        lengths.append(len(text))
        image = pdf[index].render(scale=1.6).to_pil().convert('RGB')
        image.save(output / f'{name}-{index + 1:02d}.png')
        image.thumbnail((250, 354))
        thumb = Image.new('RGB', (270, 385), '#dce5df')
        thumb.paste(image, ((270-image.width)//2, 24))
        ImageDraw.Draw(thumb).text((10, 6), f'{name} p{index+1}', fill='#20382e')
        thumbs.append(thumb)
    for start in range(0, len(thumbs), 12):
        sheet = Image.new('RGB', (270*4, 385*3), '#dce5df')
        for i, thumb in enumerate(thumbs[start:start+12]):
            sheet.paste(thumb, ((i % 4)*270, (i // 4)*385))
        sheet.save(output / f'{name}-contact-{start//12+1}.png')
    report[name] = {'pages': expected, 'text_characters_per_page': lengths}
(output / 'pdf-inspection.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print(json.dumps(report))
